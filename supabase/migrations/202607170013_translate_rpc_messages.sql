-- Переводим все сообщения raise exception в PL/pgSQL-функциях на английский —
-- часть перехода приложения на EN/UK и отказа от русской локализации.
-- CREATE OR REPLACE FUNCTION безопасно переигрывает существующие функции,
-- меняются только строки сообщений, логика не трогается.

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
    raise exception 'Cannot delete vehicle: bags or calls still reference it. Deactivate it first.';
end;
$$;

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

    perform public.adjust_stock(item.consumable_id, -item.quantity);
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
    perform public.adjust_stock(item.consumable_id, item.quantity);
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

    perform public.adjust_stock(item.consumable_id, -item.quantity);
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
    perform public.adjust_stock(item.consumable_id, item.quantity);
  end loop;

  delete from public.calls where id = p_call_id and organization_id = v_org_id;
end;
$$;
