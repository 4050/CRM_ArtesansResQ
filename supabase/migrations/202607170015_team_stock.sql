-- Двухуровневый склад: основной склад (как раньше, consumables.qty_in_stock,
-- админ) + маленький общий склад команды (team_stock), не зависящий от
-- машины/сумки/конкретного сотрудника. Строка в team_stock появляется
-- только когда позицию впервые выдали — команда не видит то, чего ей не
-- выдавали (все запросы к team_stock идут через inner join к consumables).
-- Списания по вызовам теперь идут со склада команды, а не с основного.

alter table public.stock_movements add column if not exists warehouse text not null default 'main' check (warehouse in ('main', 'team'));

create table if not exists public.team_stock (
  id uuid default gen_random_uuid() primary key,
  consumable_id uuid not null references public.consumables(id) on delete cascade,
  qty_in_stock integer not null default 0 check (qty_in_stock >= 0),
  organization_id uuid not null references public.organizations(id),
  created_at timestamptz not null default now(),
  unique (consumable_id)
);

create index if not exists stock_movements_warehouse_idx on public.stock_movements(warehouse, created_at desc);
create index if not exists team_stock_organization_id_idx on public.team_stock(organization_id);

alter table public.team_stock enable row level security;

drop policy if exists "Authenticated read team stock" on public.team_stock;
create policy "Authenticated read team stock" on public.team_stock
  for select to authenticated using (organization_id = public.current_org_id());

-- log_stock_movement: те же две вставки, что и раньше, но теперь явно
-- помечают warehouse = 'main' (раньше колонки не было — default покрывал это).
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
      quantity_before, quantity_after, user_id, organization_id, warehouse
    ) values (
      new.id, 'opening_balance', new.qty_in_stock,
      0, new.qty_in_stock, auth.uid(), new.organization_id, 'main'
    );
    return new;
  end if;

  delta := new.qty_in_stock - old.qty_in_stock;
  if delta = 0 then
    return new;
  end if;

  insert into public.stock_movements (
    consumable_id, movement_type, quantity_delta,
    quantity_before, quantity_after, user_id, organization_id, warehouse
  ) values (
    new.id,
    case when delta > 0 then 'increase' else 'decrease' end,
    delta, old.qty_in_stock, new.qty_in_stock, auth.uid(), new.organization_id, 'main'
  );

  return new;
end;
$$;

create or replace function public.log_team_stock_movement()
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
      quantity_before, quantity_after, user_id, organization_id, warehouse
    ) values (
      new.consumable_id, 'opening_balance', new.qty_in_stock,
      0, new.qty_in_stock, auth.uid(), new.organization_id, 'team'
    );
    return new;
  end if;

  delta := new.qty_in_stock - old.qty_in_stock;
  if delta = 0 then
    return new;
  end if;

  insert into public.stock_movements (
    consumable_id, movement_type, quantity_delta,
    quantity_before, quantity_after, user_id, organization_id, warehouse
  ) values (
    new.consumable_id,
    case when delta > 0 then 'increase' else 'decrease' end,
    delta, old.qty_in_stock, new.qty_in_stock, auth.uid(), new.organization_id, 'team'
  );

  return new;
end;
$$;

drop trigger if exists team_stock_movement on public.team_stock;
create trigger team_stock_movement
  after insert or update of qty_in_stock on public.team_stock
  for each row execute function public.log_team_stock_movement();

create or replace function public.adjust_team_stock(p_consumable_id uuid, p_delta integer)
returns public.team_stock
language plpgsql
security definer set search_path = ''
as $$
declare
  updated public.team_stock;
  current_qty integer;
begin
  insert into public.team_stock (consumable_id, qty_in_stock, organization_id)
  values (p_consumable_id, 0, (select organization_id from public.consumables where id = p_consumable_id))
  on conflict (consumable_id) do nothing;

  update public.team_stock
  set qty_in_stock = qty_in_stock + p_delta
  where consumable_id = p_consumable_id and qty_in_stock + p_delta >= 0
  returning * into updated;

  if not found then
    select qty_in_stock into current_qty from public.team_stock where consumable_id = p_consumable_id;
    raise exception 'Not enough of this item in team stock (in stock: %, requested: %)', current_qty, -p_delta;
  end if;

  return updated;
end;
$$;

revoke all on function public.adjust_team_stock(uuid, integer) from public;

create or replace function public.transfer_to_team_stock(p_consumable_id uuid, p_quantity integer)
returns public.team_stock
language plpgsql
security definer set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Only an administrator can issue stock to the team';
  end if;
  if p_quantity <= 0 then
    raise exception 'Transfer quantity must be greater than zero';
  end if;
  if not exists (
    select 1 from public.consumables
    where id = p_consumable_id and is_active = true and organization_id = public.current_org_id()
  ) then
    raise exception 'Item not found or removed from inventory';
  end if;

  perform public.adjust_stock(p_consumable_id, -p_quantity);
  return public.adjust_team_stock(p_consumable_id, p_quantity);
end;
$$;

revoke all on function public.transfer_to_team_stock(uuid, integer) from public;
grant execute on function public.transfer_to_team_stock(uuid, integer) to authenticated;

-- Списания вызовов теперь двигают склад команды, а не основной.
create or replace function public.create_call_with_writeoffs(
  p_date timestamptz,
  p_description text,
  p_vehicle_id uuid,
  p_bag_id uuid,
  p_writeoffs jsonb default '[]'::jsonb
)
returns uuid
language plpgsql
security definer set search_path = ''
as $$
declare
  new_call_id uuid;
  v_org_id uuid;
  item record;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  v_org_id := public.current_org_id();
  if v_org_id is null then
    raise exception 'User is not linked to any organization';
  end if;

  if not exists (
    select 1 from public.vehicles
    where id = p_vehicle_id and organization_id = v_org_id
  ) then
    raise exception 'Vehicle not found';
  end if;

  if not exists (
    select 1 from public.bags
    where id = p_bag_id and vehicle_id = p_vehicle_id and organization_id = v_org_id
  ) then
    raise exception 'Bag does not belong to the selected vehicle';
  end if;

  insert into public.calls (date, description, vehicle_id, bag_id, user_id, organization_id)
  values (p_date, nullif(trim(p_description), ''), p_vehicle_id, p_bag_id, auth.uid(), v_org_id)
  returning id into new_call_id;

  for item in
    select consumable_id, sum(quantity)::integer as quantity
    from jsonb_to_recordset(coalesce(p_writeoffs, '[]'::jsonb))
      as x(consumable_id uuid, quantity integer)
    group by consumable_id
  loop
    if item.quantity <= 0 then
      raise exception 'Write-off quantity must be greater than zero';
    end if;

    perform 1 from public.consumables
    where id = item.consumable_id and is_active = true and organization_id = v_org_id
    for update;
    if not found then
      raise exception 'Consumable % not found or removed from inventory', item.consumable_id;
    end if;

    perform public.adjust_team_stock(item.consumable_id, -item.quantity);
    insert into public.writeoffs (call_id, consumable_id, quantity, user_id, organization_id)
    values (new_call_id, item.consumable_id, item.quantity, auth.uid(), v_org_id);
  end loop;

  return new_call_id;
end;
$$;

create or replace function public.update_call_with_writeoffs(
  p_call_id uuid,
  p_date timestamptz,
  p_description text,
  p_vehicle_id uuid,
  p_bag_id uuid,
  p_writeoffs jsonb default '[]'::jsonb
)
returns void
language plpgsql
security definer set search_path = ''
as $$
declare
  v_org_id uuid;
  item record;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  v_org_id := public.current_org_id();
  if v_org_id is null then
    raise exception 'User is not linked to any organization';
  end if;

  perform 1 from public.calls
  where id = p_call_id and organization_id = v_org_id and (user_id = auth.uid() or public.is_admin())
  for update;
  if not found then
    raise exception 'Call not found or insufficient permissions';
  end if;

  if not exists (
    select 1 from public.bags
    where id = p_bag_id and vehicle_id = p_vehicle_id and organization_id = v_org_id
  ) then
    raise exception 'Bag does not belong to the selected vehicle';
  end if;

  for item in
    select consumable_id, sum(quantity)::integer as quantity
    from public.writeoffs
    where call_id = p_call_id and organization_id = v_org_id
    group by consumable_id
  loop
    perform public.adjust_team_stock(item.consumable_id, item.quantity);
  end loop;

  delete from public.writeoffs where call_id = p_call_id and organization_id = v_org_id;

  update public.calls
  set date = p_date,
      description = nullif(trim(p_description), ''),
      vehicle_id = p_vehicle_id,
      bag_id = p_bag_id
  where id = p_call_id and organization_id = v_org_id;

  for item in
    select consumable_id, sum(quantity)::integer as quantity
    from jsonb_to_recordset(coalesce(p_writeoffs, '[]'::jsonb))
      as x(consumable_id uuid, quantity integer)
    group by consumable_id
  loop
    if item.quantity <= 0 then
      raise exception 'Write-off quantity must be greater than zero';
    end if;

    perform 1 from public.consumables where id = item.consumable_id and organization_id = v_org_id for update;
    if not found then
      raise exception 'Consumable % not found', item.consumable_id;
    end if;

    perform public.adjust_team_stock(item.consumable_id, -item.quantity);
    insert into public.writeoffs (call_id, consumable_id, quantity, user_id, organization_id)
    values (p_call_id, item.consumable_id, item.quantity, auth.uid(), v_org_id);
  end loop;
end;
$$;

create or replace function public.delete_call_with_writeoffs(p_call_id uuid)
returns void
language plpgsql
security definer set search_path = ''
as $$
declare
  v_org_id uuid;
  item record;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  v_org_id := public.current_org_id();
  if v_org_id is null then
    raise exception 'User is not linked to any organization';
  end if;

  perform 1 from public.calls
  where id = p_call_id and organization_id = v_org_id and (user_id = auth.uid() or public.is_admin())
  for update;
  if not found then
    raise exception 'Call not found or insufficient permissions';
  end if;

  for item in
    select consumable_id, sum(quantity)::integer as quantity
    from public.writeoffs
    where call_id = p_call_id and organization_id = v_org_id
    group by consumable_id
  loop
    perform public.adjust_team_stock(item.consumable_id, item.quantity);
  end loop;

  delete from public.calls where id = p_call_id and organization_id = v_org_id;
end;
$$;
