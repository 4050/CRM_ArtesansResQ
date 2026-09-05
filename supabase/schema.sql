-- МедСклад: схема базы данных v2.0 (мультитенантная)

-- Организации (тенанты). Каждая организация видит только свои данные.
create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

-- Организация по умолчанию для этой установки. Фиксированный id, чтобы
-- на него можно было детерминированно ссылаться из raw_user_meta_data
-- при создании первого пользователя.
insert into public.organizations (id, name)
values ('11111111-1111-1111-1111-111111111111', 'МедСклад — основная организация');

-- Пользователи (расширение auth.users)
create table public.users (
  id uuid references auth.users(id) on delete cascade primary key,
  name text not null,
  role text not null default 'medic' check (role in ('master_admin', 'admin', 'medic')),
  brigade text,
  is_active boolean not null default true,
  organization_id uuid not null references public.organizations(id),
  created_at timestamptz default now()
);

-- Машины
create table public.vehicles (
  id uuid default gen_random_uuid() primary key,
  number text not null,
  name text,
  is_active boolean default true,
  organization_id uuid not null references public.organizations(id),
  created_at timestamptz default now(),
  unique (organization_id, number)
);

-- Сумки
create table public.bags (
  id uuid default gen_random_uuid() primary key,
  number text not null,
  description text,
  is_active boolean not null default true,
  organization_id uuid not null references public.organizations(id),
  created_at timestamptz default now(),
  unique (organization_id, number)
);

-- Расходники
create table public.consumables (
  id uuid default gen_random_uuid() primary key,
  code text,
  name text not null,
  category text not null default 'other',
  unit text not null default 'pcs',
  source text not null default 'other',
  qty_in_stock integer not null default 0 check (qty_in_stock >= 0),
  qty_minimum integer not null default 0 check (qty_minimum >= 0),
  description text,
  is_active boolean not null default true,
  organization_id uuid not null references public.organizations(id),
  created_at timestamptz default now(),
  unique (organization_id, code)
);

-- Вызовы
create table public.calls (
  id uuid default gen_random_uuid() primary key,
  call_number text,
  date timestamptz not null,
  description text,
  vehicle_id uuid references public.vehicles(id),
  bag_id uuid references public.bags(id),
  -- on delete set null: a deleted user's call history is kept, just
  -- orphaned - see 202608260001, same reasoning as consumable_id below.
  user_id uuid references public.users(id) on delete set null,
  organization_id uuid not null references public.organizations(id),
  created_at timestamptz default now()
);

-- Списания
create table public.writeoffs (
  id uuid default gen_random_uuid() primary key,
  call_id uuid references public.calls(id) on delete cascade,
  -- on delete set null (not cascade): a deleted consumable's write-off
  -- history is kept, just orphaned - see 202607230001.
  consumable_id uuid references public.consumables(id) on delete set null,
  quantity integer not null check (quantity > 0),
  -- on delete set null, same reasoning as consumable_id above - see 202608260001.
  user_id uuid references public.users(id) on delete set null,
  organization_id uuid not null references public.organizations(id),
  created_at timestamptz default now()
);

-- Журнал движения складских остатков
create table public.stock_movements (
  id uuid default gen_random_uuid() primary key,
  -- Nullable + on delete set null, same reasoning as writeoffs.consumable_id
  -- above - see 202607230001.
  consumable_id uuid references public.consumables(id) on delete set null,
  movement_type text not null check (movement_type in ('opening_balance', 'increase', 'decrease')),
  quantity_delta integer not null check (quantity_delta <> 0),
  quantity_before integer not null,
  quantity_after integer not null,
  -- on delete set null, same reasoning as consumable_id above - see 202608260001.
  user_id uuid references public.users(id) on delete set null,
  organization_id uuid not null references public.organizations(id),
  warehouse text not null default 'main' check (warehouse in ('main', 'team')),
  created_at timestamptz not null default now()
);

-- Склад команды: маленький общий склад, отдельный от основного. Строка
-- появляется только когда позицию впервые выдали со склада — команда не
-- видит то, что ей не выдавали (запросы делают inner join к этой таблице).
create table public.team_stock (
  id uuid default gen_random_uuid() primary key,
  consumable_id uuid not null references public.consumables(id) on delete cascade,
  qty_in_stock integer not null default 0 check (qty_in_stock >= 0),
  organization_id uuid not null references public.organizations(id),
  created_at timestamptz not null default now(),
  unique (consumable_id)
);

create index stock_movements_created_at_idx on public.stock_movements(created_at desc);
create index stock_movements_consumable_id_idx on public.stock_movements(consumable_id, created_at desc);
create index stock_movements_user_id_idx on public.stock_movements(user_id, created_at desc);
create index stock_movements_warehouse_idx on public.stock_movements(warehouse, created_at desc);

-- Индексы под паттерны запросов приложения (lib/data/*.ts), все org-scoped.
create index users_organization_id_idx on public.users(organization_id);
create index calls_organization_id_date_idx on public.calls(organization_id, date desc);
create index writeoffs_organization_id_created_at_idx on public.writeoffs(organization_id, created_at desc);
create index stock_movements_organization_id_created_at_idx on public.stock_movements(organization_id, created_at desc);
create index team_stock_organization_id_idx on public.team_stock(organization_id);

-- RLS (Row Level Security) — каждая организация видит только свои данные.
alter table public.organizations enable row level security;
alter table public.users enable row level security;
alter table public.vehicles enable row level security;
alter table public.bags enable row level security;
alter table public.consumables enable row level security;
alter table public.calls enable row level security;
alter table public.writeoffs enable row level security;
alter table public.stock_movements enable row level security;
alter table public.team_stock enable row level security;

-- master_admin has every admin capability plus user-role management —
-- widening this one check makes it flow automatically into every existing
-- admin-gated policy/RPC below without touching each of them individually.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer set search_path = ''
as $$
  select exists (
    select 1 from public.users
    where id = auth.uid() and role in ('admin', 'master_admin')
  );
$$;

create or replace function public.is_master_admin()
returns boolean
language sql
stable
security definer set search_path = ''
as $$
  select exists (
    select 1 from public.users
    where id = auth.uid() and role = 'master_admin'
  );
$$;

create or replace function public.current_org_id()
returns uuid
language sql
stable
security definer set search_path = ''
as $$
  select organization_id from public.users where id = auth.uid() and is_active;
$$;

-- Прямые insert'ы (например, создание позиции склада, машины или сумки из
-- приложения, не через RPC) автоматически получают организацию текущего
-- пользователя, если явно не указана.
alter table public.consumables alter column organization_id set default public.current_org_id();
alter table public.vehicles alter column organization_id set default public.current_org_id();
alter table public.bags alter column organization_id set default public.current_org_id();

create policy "Users read own organization" on public.organizations
  for select to authenticated using (id = public.current_org_id());

create policy "Authenticated users can read users" on public.users
  for select to authenticated using (organization_id = public.current_org_id());
create policy "Authenticated users can update own profile" on public.users
  for update to authenticated
  using (auth.uid() = id)
  with check (
    auth.uid() = id
    and organization_id = public.current_org_id()
    and role = (select u.role from public.users u where u.id = auth.uid())
  );

create policy "Authenticated read vehicles" on public.vehicles
  for select to authenticated using (organization_id = public.current_org_id());
create policy "Admins insert vehicles" on public.vehicles
  for insert to authenticated
  with check (public.is_admin() and organization_id = public.current_org_id());
create policy "Admins update vehicles" on public.vehicles
  for update to authenticated
  using (public.is_admin() and organization_id = public.current_org_id())
  with check (public.is_admin() and organization_id = public.current_org_id());

create policy "Authenticated read bags" on public.bags
  for select to authenticated using (organization_id = public.current_org_id());
create policy "Admins insert bags" on public.bags
  for insert to authenticated
  with check (public.is_admin() and organization_id = public.current_org_id());
create policy "Admins update bags" on public.bags
  for update to authenticated
  using (public.is_admin() and organization_id = public.current_org_id())
  with check (public.is_admin() and organization_id = public.current_org_id());

create policy "Authenticated read consumables" on public.consumables
  for select to authenticated using (organization_id = public.current_org_id());
create policy "Admins insert consumables" on public.consumables
  for insert to authenticated
  with check (public.is_admin() and organization_id = public.current_org_id());
create policy "Admins update consumables" on public.consumables
  for update to authenticated
  using (public.is_admin() and organization_id = public.current_org_id())
  with check (public.is_admin() and organization_id = public.current_org_id());

create policy "Authenticated read calls" on public.calls
  for select to authenticated using (organization_id = public.current_org_id());
create policy "Owners or admins update calls" on public.calls
  for update to authenticated
  using (organization_id = public.current_org_id() and (user_id = auth.uid() or public.is_admin()))
  with check (organization_id = public.current_org_id() and (user_id = auth.uid() or public.is_admin()));

create policy "Authenticated read writeoffs" on public.writeoffs
  for select to authenticated using (organization_id = public.current_org_id());

create policy "Authenticated read stock movements" on public.stock_movements
  for select to authenticated using (organization_id = public.current_org_id());

-- team_stock не даёт insert/update напрямую с клиента — только select. Все
-- изменения количества идут через transfer_to_team_stock/adjust_team_stock
-- (security definer), как и остальные операции с остатками в этой схеме.
create policy "Authenticated read team stock" on public.team_stock
  for select to authenticated using (organization_id = public.current_org_id());

-- Функция: автоматически создавать профиль при регистрации.
-- organization_id обязателен в raw_user_meta_data (передаётся при создании
-- пользователя через Dashboard/Admin API) — без него транзакция откатывается.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
declare
  v_org_id uuid;
begin
  v_org_id := nullif(new.raw_user_meta_data->>'organization_id', '')::uuid;

  if v_org_id is null then
    raise exception 'organization_id is required in raw_user_meta_data when creating a user';
  end if;

  insert into public.users (id, name, role, organization_id)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    'medic',
    v_org_id
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

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

create trigger consumables_stock_movement
  after insert or update of qty_in_stock on public.consumables
  for each row execute function public.log_stock_movement();

-- Начальная точка для позиций, добавленных тестовыми данными до создания триггера.
insert into public.stock_movements (
  consumable_id, movement_type, quantity_delta,
  quantity_before, quantity_after, user_id, organization_id
)
select id, 'opening_balance', qty_in_stock, 0, qty_in_stock, null, organization_id
from public.consumables
where qty_in_stock <> 0;

-- Атомарное изменение остатка (защита от гонок при параллельном списании)
create or replace function public.adjust_stock(p_consumable_id uuid, p_delta integer)
returns public.consumables
language plpgsql
security definer set search_path = ''
as $$
declare
  updated public.consumables;
begin
  update public.consumables
  set qty_in_stock = qty_in_stock + p_delta
  where id = p_consumable_id
  returning * into updated;

  if not found then
    raise exception 'Consumable % not found', p_consumable_id;
  end if;

  if updated.qty_in_stock < 0 then
    raise exception 'Not enough "%" in stock (in stock: %, requested: %)',
      updated.name, updated.qty_in_stock - p_delta, -p_delta;
  end if;

  return updated;
end;
$$;

revoke all on function public.adjust_stock(uuid, integer) from public;

-- Журнал движений склада команды — отдельный триггер, тот же stock_movements,
-- warehouse = 'team' отличает от основного склада.
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

create trigger team_stock_movement
  after insert or update of qty_in_stock on public.team_stock
  for each row execute function public.log_team_stock_movement();

-- Атомарное изменение остатка склада команды. Строка создаётся при первой
-- выдаче (см. transfer_to_team_stock) или лениво здесь же — что бы ни
-- вызвало adjust_team_stock первым. WHERE-guard в update делает проверку
-- "хватает ли" атомарной, без отдельного select-then-act.
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

-- Выдача со склада: списывает с основного (переиспользует adjust_stock —
-- та же проверка отрицательного остатка) и прибавляет на склад команды.
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

-- Возврат ошибочной выдачи: списывает с команды (проверка достаточного
-- остатка внутри adjust_team_stock) и возвращает на основной склад. Не
-- требует is_active — позицию могли архивировать уже после выдачи, но
-- исправить ошибочную выдачу нужно в любом случае.
create or replace function public.return_from_team_stock(p_consumable_id uuid, p_quantity integer)
returns public.team_stock
language plpgsql
security definer set search_path = ''
as $$
declare
  updated public.team_stock;
begin
  if not public.is_admin() then
    raise exception 'Only an administrator can return stock from the team';
  end if;
  if p_quantity <= 0 then
    raise exception 'Return quantity must be greater than zero';
  end if;
  if not exists (
    select 1 from public.consumables
    where id = p_consumable_id and organization_id = public.current_org_id()
  ) then
    raise exception 'Item not found';
  end if;

  updated := public.adjust_team_stock(p_consumable_id, -p_quantity);
  perform public.adjust_stock(p_consumable_id, p_quantity);
  return updated;
end;
$$;

revoke all on function public.return_from_team_stock(uuid, integer) from public;
grant execute on function public.return_from_team_stock(uuid, integer) to authenticated;

-- Списание со склада команды без возврата на основной (утрачено/повреждено/
-- просрочено у команды) — в отличие от return_from_team_stock, основной
-- склад не трогается. Логируется автоматически тем же триггером
-- log_team_stock_movement, что и любое изменение team_stock.qty_in_stock.
create or replace function public.discard_from_team_stock(p_consumable_id uuid, p_quantity integer)
returns public.team_stock
language plpgsql
security definer set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Only an administrator can discard stock from the team';
  end if;
  if p_quantity <= 0 then
    raise exception 'Discard quantity must be greater than zero';
  end if;
  if not exists (
    select 1 from public.consumables
    where id = p_consumable_id and organization_id = public.current_org_id()
  ) then
    raise exception 'Item not found';
  end if;

  return public.adjust_team_stock(p_consumable_id, -p_quantity);
end;
$$;

revoke all on function public.discard_from_team_stock(uuid, integer) from public;
grant execute on function public.discard_from_team_stock(uuid, integer) to authenticated;

-- Removes a team_stock row entirely once its quantity is back to zero (via
-- return_from_team_stock/discard_from_team_stock) - blocked while any
-- stock remains, so the remainder can't silently disappear unlogged.
create or replace function public.delete_team_stock_item(p_consumable_id uuid)
returns void
language plpgsql
security definer set search_path = ''
as $$
declare
  current_qty integer;
begin
  if not public.is_admin() then
    raise exception 'Only an administrator can remove items from team stock';
  end if;

  select qty_in_stock into current_qty
  from public.team_stock
  where consumable_id = p_consumable_id and organization_id = public.current_org_id();

  if not found then
    raise exception 'Item not found in team stock';
  end if;

  if current_qty > 0 then
    raise exception 'Return or discard the remaining % unit(s) before removing this item from team stock', current_qty;
  end if;

  delete from public.team_stock
  where consumable_id = p_consumable_id and organization_id = public.current_org_id();
end;
$$;

revoke all on function public.delete_team_stock_item(uuid) from public;
grant execute on function public.delete_team_stock_item(uuid) to authenticated;

-- adjust_stock не выдан authenticated напрямую — вызывается только из функций
-- ниже, каждая из которых уже проверила принадлежность организации.
create or replace function public.restock_consumable(p_consumable_id uuid, p_quantity integer)
returns public.consumables
language plpgsql
security definer set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Only an administrator can restock inventory';
  end if;
  if p_quantity <= 0 then
    raise exception 'Restock quantity must be greater than zero';
  end if;
  if not exists (
    select 1 from public.consumables
    where id = p_consumable_id and is_active = true and organization_id = public.current_org_id()
  ) then
    raise exception 'Item not found or removed from inventory';
  end if;
  return public.adjust_stock(p_consumable_id, p_quantity);
end;
$$;

revoke all on function public.restock_consumable(uuid, integer) from public;
grant execute on function public.restock_consumable(uuid, integer) to authenticated;

create or replace function public.archive_consumable(p_consumable_id uuid)
returns void
language plpgsql
security definer set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Only an administrator can remove inventory items';
  end if;

  update public.consumables
  set is_active = false
  where id = p_consumable_id and is_active = true and organization_id = public.current_org_id();

  if not found then
    raise exception 'Item not found or already removed';
  end if;
end;
$$;

revoke all on function public.archive_consumable(uuid) from public;
grant execute on function public.archive_consumable(uuid) to authenticated;

create or replace function public.delete_consumable(p_consumable_id uuid)
returns void
language plpgsql
security definer set search_path = ''
as $$
declare
  team_qty integer;
begin
  if not public.is_admin() then
    raise exception 'Only an administrator can delete inventory items';
  end if;

  select qty_in_stock into team_qty
  from public.team_stock
  where consumable_id = p_consumable_id and organization_id = public.current_org_id();

  if team_qty is not null and team_qty > 0 then
    raise exception 'This item still has % unit(s) in team stock - return or discard it there first', team_qty;
  end if;

  delete from public.consumables
  where id = p_consumable_id and organization_id = public.current_org_id();

  if not found then
    raise exception 'Item not found';
  end if;
end;
$$;

revoke all on function public.delete_consumable(uuid) from public;
grant execute on function public.delete_consumable(uuid) to authenticated;

create or replace function public.archive_vehicle(p_vehicle_id uuid)
returns void
language plpgsql
security definer set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Only an administrator can delete vehicles';
  end if;

  update public.vehicles
  set is_active = false
  where id = p_vehicle_id and is_active = true and organization_id = public.current_org_id();

  if not found then
    raise exception 'Vehicle not found or already removed';
  end if;
end;
$$;

revoke all on function public.archive_vehicle(uuid) from public;
grant execute on function public.archive_vehicle(uuid) to authenticated;

create or replace function public.archive_bag(p_bag_id uuid)
returns void
language plpgsql
security definer set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Only an administrator can delete bags';
  end if;

  update public.bags
  set is_active = false
  where id = p_bag_id and is_active = true and organization_id = public.current_org_id();

  if not found then
    raise exception 'Bag not found or already removed';
  end if;
end;
$$;

revoke all on function public.archive_bag(uuid) from public;
grant execute on function public.archive_bag(uuid) to authenticated;

-- Безвозвратное удаление — отдельно от archive_*/is_active. Ловим нарушение
-- внешнего ключа и превращаем его в понятное сообщение вместо голой ошибки
-- Postgres, если на машину/сумку ещё ссылаются сумки/вызовы.
create or replace function public.delete_vehicle(p_vehicle_id uuid)
returns void
language plpgsql
security definer set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Only an administrator can delete vehicles';
  end if;

  delete from public.vehicles
  where id = p_vehicle_id and organization_id = public.current_org_id();

  if not found then
    raise exception 'Vehicle not found';
  end if;
exception
  when foreign_key_violation then
    raise exception 'Cannot delete vehicle: calls still reference it. Deactivate it first.';
end;
$$;

revoke all on function public.delete_vehicle(uuid) from public;
grant execute on function public.delete_vehicle(uuid) to authenticated;

create or replace function public.delete_bag(p_bag_id uuid)
returns void
language plpgsql
security definer set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Only an administrator can delete bags';
  end if;

  delete from public.bags
  where id = p_bag_id and organization_id = public.current_org_id();

  if not found then
    raise exception 'Bag not found';
  end if;
exception
  when foreign_key_violation then
    raise exception 'Cannot delete bag: calls still reference it. Deactivate it first.';
end;
$$;

revoke all on function public.delete_bag(uuid) from public;
grant execute on function public.delete_bag(uuid) to authenticated;

-- Назначение ролей — только master_admin, и только admin/medic в качестве
-- цели (второй master_admin заводится вручную через SQL Editor, как и
-- первый — не через этот RPC). Менять собственную роль через этот путь
-- нельзя, чтобы исключить случайную потерю доступа.
create or replace function public.set_user_role(p_user_id uuid, p_role text)
returns void
language plpgsql
security definer set search_path = ''
as $$
begin
  if not public.is_master_admin() then
    raise exception 'Only a master admin can change user roles';
  end if;
  if p_role not in ('admin', 'medic') then
    raise exception 'Role must be admin or medic';
  end if;
  if p_user_id = auth.uid() then
    raise exception 'You cannot change your own role';
  end if;

  update public.users
  set role = p_role
  where id = p_user_id and organization_id = public.current_org_id();

  if not found then
    raise exception 'User not found in your organization';
  end if;
end;
$$;

revoke all on function public.set_user_role(uuid, text) from public;
grant execute on function public.set_user_role(uuid, text) to authenticated;

-- Транзакционные операции с вызовами. Один вызов RPC выполняется PostgreSQL
-- целиком: при любой ошибке вызов, списания и остатки откатываются вместе.
-- Все три функции ниже — security definer, RLS внутри них не действует,
-- поэтому принадлежность организации проверяется явно в каждой.
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
    where id = p_bag_id and organization_id = v_org_id
  ) then
    raise exception 'Bag not found';
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
    select 1 from public.vehicles
    where id = p_vehicle_id and organization_id = v_org_id
  ) then
    raise exception 'Vehicle not found';
  end if;

  if not exists (
    select 1 from public.bags
    where id = p_bag_id and organization_id = v_org_id
  ) then
    raise exception 'Bag not found';
  end if;

  for item in
    select consumable_id, sum(quantity)::integer as quantity
    from public.writeoffs
    where call_id = p_call_id and organization_id = v_org_id
    group by consumable_id
  loop
    -- A deleted consumable's writeoffs keep their row with consumable_id set
    -- to null (see 202607230001) - there's nothing to return to team_stock
    -- for those (the team_stock row itself is long gone, cascade-deleted
    -- alongside the consumable), and adjust_team_stock(null, ...) would
    -- violate team_stock's not-null consumable_id/organization_id columns.
    continue when item.consumable_id is null;
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
    -- Same guard as update_call_with_writeoffs above.
    continue when item.consumable_id is null;
    perform public.adjust_team_stock(item.consumable_id, item.quantity);
  end loop;

  delete from public.calls where id = p_call_id and organization_id = v_org_id;
end;
$$;

revoke all on function public.create_call_with_writeoffs(timestamptz, text, uuid, uuid, jsonb) from public;
revoke all on function public.update_call_with_writeoffs(uuid, timestamptz, text, uuid, uuid, jsonb) from public;
revoke all on function public.delete_call_with_writeoffs(uuid) from public;
grant execute on function public.create_call_with_writeoffs(timestamptz, text, uuid, uuid, jsonb) to authenticated;
grant execute on function public.update_call_with_writeoffs(uuid, timestamptz, text, uuid, uuid, jsonb) to authenticated;
grant execute on function public.delete_call_with_writeoffs(uuid) to authenticated;

-- Aggregates the write-offs report (totals + per-item breakdown) in SQL so
-- it covers every matching row for the selected range, not just however
-- many the client happened to fetch - see 202608190002.
create or replace function public.writeoffs_report(p_from timestamptz, p_to timestamptz)
returns jsonb
language sql
stable
set search_path = ''
as $$
  with scoped as (
    select w.quantity, w.user_id, c.name, c.unit, c.category, c.source
    from public.writeoffs w
    left join public.consumables c on c.id = w.consumable_id
    where w.organization_id = public.current_org_id()
      and w.created_at >= p_from
      and w.created_at <= p_to
  ),
  breakdown as (
    select name, unit, category, source, sum(quantity)::bigint as quantity
    from scoped
    group by name, unit, category, source
    order by sum(quantity) desc
  )
  select jsonb_build_object(
    'operations', (select count(*) from scoped),
    'totalQuantity', (select coalesce(sum(quantity), 0) from scoped),
    'employees', (select count(distinct user_id) from scoped),
    'byConsumable', (select coalesce(jsonb_agg(to_jsonb(breakdown)), '[]'::jsonb) from breakdown)
  );
$$;

revoke all on function public.writeoffs_report(timestamptz, timestamptz) from public;
grant execute on function public.writeoffs_report(timestamptz, timestamptz) to authenticated;
