alter table public.consumables
  add column if not exists code text;

alter table public.consumables
  add column if not exists is_active boolean not null default true;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer set search_path = ''
as $$
  select exists (
    select 1 from public.users
    where id = auth.uid() and role = 'admin'
  );
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
    raise exception 'Расходник % не найден', p_consumable_id;
  end if;

  if updated.qty_in_stock < 0 then
    raise exception 'Недостаточно расходника "%" на складе (остаток: %, запрошено: %)',
      updated.name, updated.qty_in_stock - p_delta, -p_delta;
  end if;

  return updated;
end;
$$;

revoke all on function public.adjust_stock(uuid, integer) from public;

create or replace function public.restock_consumable(p_consumable_id uuid, p_quantity integer)
returns public.consumables
language plpgsql
security definer set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Пополнять склад может только администратор';
  end if;
  if p_quantity <= 0 then
    raise exception 'Количество пополнения должно быть больше нуля';
  end if;
  if not exists (
    select 1 from public.consumables
    where id = p_consumable_id and is_active = true
  ) then
    raise exception 'Позиция не найдена или удалена со склада';
  end if;
  return public.adjust_stock(p_consumable_id, p_quantity);
end;
$$;

revoke all on function public.restock_consumable(uuid, integer) from public;
grant execute on function public.restock_consumable(uuid, integer) to authenticated;

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
  item record;
begin
  if auth.uid() is null then
    raise exception 'Требуется авторизация';
  end if;

  if not exists (
    select 1 from public.bags
    where id = p_bag_id and vehicle_id = p_vehicle_id
  ) then
    raise exception 'Сумка не принадлежит выбранной машине';
  end if;

  insert into public.calls (date, description, vehicle_id, bag_id, user_id)
  values (p_date, nullif(trim(p_description), ''), p_vehicle_id, p_bag_id, auth.uid())
  returning id into new_call_id;

  for item in
    select consumable_id, sum(quantity)::integer as quantity
    from jsonb_to_recordset(coalesce(p_writeoffs, '[]'::jsonb))
      as x(consumable_id uuid, quantity integer)
    group by consumable_id
  loop
    if item.quantity <= 0 then
      raise exception 'Количество списания должно быть больше нуля';
    end if;

    perform 1 from public.consumables
    where id = item.consumable_id and is_active = true
    for update;
    if not found then
      raise exception 'Расходник % не найден или удалён со склада', item.consumable_id;
    end if;

    perform public.adjust_stock(item.consumable_id, -item.quantity);
    insert into public.writeoffs (call_id, consumable_id, quantity, user_id)
    values (new_call_id, item.consumable_id, item.quantity, auth.uid());
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
  item record;
begin
  if auth.uid() is null then
    raise exception 'Требуется авторизация';
  end if;

  perform 1 from public.calls
  where id = p_call_id and (user_id = auth.uid() or public.is_admin())
  for update;
  if not found then
    raise exception 'Вызов не найден или недостаточно прав';
  end if;

  if not exists (
    select 1 from public.bags
    where id = p_bag_id and vehicle_id = p_vehicle_id
  ) then
    raise exception 'Сумка не принадлежит выбранной машине';
  end if;

  for item in
    select consumable_id, sum(quantity)::integer as quantity
    from public.writeoffs
    where call_id = p_call_id
    group by consumable_id
  loop
    perform public.adjust_stock(item.consumable_id, item.quantity);
  end loop;

  delete from public.writeoffs where call_id = p_call_id;

  update public.calls
  set date = p_date,
      description = nullif(trim(p_description), ''),
      vehicle_id = p_vehicle_id,
      bag_id = p_bag_id
  where id = p_call_id;

  for item in
    select consumable_id, sum(quantity)::integer as quantity
    from jsonb_to_recordset(coalesce(p_writeoffs, '[]'::jsonb))
      as x(consumable_id uuid, quantity integer)
    group by consumable_id
  loop
    if item.quantity <= 0 then
      raise exception 'Количество списания должно быть больше нуля';
    end if;

    perform 1 from public.consumables where id = item.consumable_id for update;
    if not found then
      raise exception 'Расходник % не найден', item.consumable_id;
    end if;

    perform public.adjust_stock(item.consumable_id, -item.quantity);
    insert into public.writeoffs (call_id, consumable_id, quantity, user_id)
    values (p_call_id, item.consumable_id, item.quantity, auth.uid());
  end loop;
end;
$$;

create or replace function public.delete_call_with_writeoffs(p_call_id uuid)
returns void
language plpgsql
security definer set search_path = ''
as $$
declare
  item record;
begin
  if auth.uid() is null then
    raise exception 'Требуется авторизация';
  end if;

  perform 1 from public.calls
  where id = p_call_id and (user_id = auth.uid() or public.is_admin())
  for update;
  if not found then
    raise exception 'Вызов не найден или недостаточно прав';
  end if;

  for item in
    select consumable_id, sum(quantity)::integer as quantity
    from public.writeoffs
    where call_id = p_call_id
    group by consumable_id
  loop
    perform public.adjust_stock(item.consumable_id, item.quantity);
  end loop;

  delete from public.calls where id = p_call_id;
end;
$$;

revoke all on function public.create_call_with_writeoffs(timestamptz, text, uuid, uuid, jsonb) from public;
revoke all on function public.update_call_with_writeoffs(uuid, timestamptz, text, uuid, uuid, jsonb) from public;
revoke all on function public.delete_call_with_writeoffs(uuid) from public;
grant execute on function public.create_call_with_writeoffs(timestamptz, text, uuid, uuid, jsonb) to authenticated;
grant execute on function public.update_call_with_writeoffs(uuid, timestamptz, text, uuid, uuid, jsonb) to authenticated;
grant execute on function public.delete_call_with_writeoffs(uuid) to authenticated;

notify pgrst, 'reload schema';
