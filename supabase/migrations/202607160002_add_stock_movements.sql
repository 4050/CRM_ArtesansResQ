-- Журнал движения складских остатков
create table if not exists public.stock_movements (
  id uuid default gen_random_uuid() primary key,
  consumable_id uuid not null references public.consumables(id),
  movement_type text not null check (movement_type in ('opening_balance', 'increase', 'decrease')),
  quantity_delta integer not null check (quantity_delta <> 0),
  quantity_before integer not null,
  quantity_after integer not null,
  user_id uuid references public.users(id),
  created_at timestamptz not null default now()
);

create index if not exists stock_movements_created_at_idx on public.stock_movements(created_at desc);
create index if not exists stock_movements_consumable_id_idx on public.stock_movements(consumable_id, created_at desc);
create index if not exists stock_movements_user_id_idx on public.stock_movements(user_id, created_at desc);

alter table public.stock_movements enable row level security;

drop policy if exists "Authenticated read stock movements" on public.stock_movements;
create policy "Authenticated read stock movements" on public.stock_movements
  for select to authenticated using (true);

-- Любое изменение qty_in_stock автоматически попадает в журнал, в том числе
-- изменения через RPC и прямые административные корректировки.
create or replace function public.log_stock_movement()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
declare
  delta integer;
begin
  if tg_op = 'INSERT' then
    if new.qty_in_stock = 0 then
      return new;
    end if;

    insert into public.stock_movements (
      consumable_id, movement_type, quantity_delta,
      quantity_before, quantity_after, user_id
    ) values (
      new.id, 'opening_balance', new.qty_in_stock,
      0, new.qty_in_stock, auth.uid()
    );
    return new;
  end if;

  delta := new.qty_in_stock - old.qty_in_stock;
  if delta = 0 then
    return new;
  end if;

  insert into public.stock_movements (
    consumable_id, movement_type, quantity_delta,
    quantity_before, quantity_after, user_id
  ) values (
    new.id,
    case when delta > 0 then 'increase' else 'decrease' end,
    delta, old.qty_in_stock, new.qty_in_stock, auth.uid()
  );

  return new;
end;
$$;

drop trigger if exists consumables_stock_movement on public.consumables;
create trigger consumables_stock_movement
  after insert or update of qty_in_stock on public.consumables
  for each row execute function public.log_stock_movement();

-- Начальная точка для позиций, добавленных до создания триггера (безопасно
-- перезапускать: строки уже покрытые движением по этому consumable_id пропускаются).
insert into public.stock_movements (
  consumable_id, movement_type, quantity_delta,
  quantity_before, quantity_after, user_id
)
select id, 'opening_balance', qty_in_stock, 0, qty_in_stock, null
from public.consumables
where qty_in_stock <> 0
  and not exists (
    select 1 from public.stock_movements
    where stock_movements.consumable_id = consumables.id
  );
