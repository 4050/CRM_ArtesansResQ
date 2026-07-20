-- Мультитенантность, шаг 7: все RPC-функции ниже — security definer, то есть RLS
-- внутри них НЕ действует. Проверку принадлежности организации нужно делать явно
-- в каждой из них, иначе это дыра в изоляции тенантов.

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
    raise exception 'Требуется авторизация';
  end if;

  v_org_id := public.current_org_id();
  if v_org_id is null then
    raise exception 'Пользователь не привязан ни к одной организации';
  end if;

  if not exists (
    select 1 from public.vehicles
    where id = p_vehicle_id and organization_id = v_org_id
  ) then
    raise exception 'Машина не найдена';
  end if;

  if not exists (
    select 1 from public.bags
    where id = p_bag_id and vehicle_id = p_vehicle_id and organization_id = v_org_id
  ) then
    raise exception 'Сумка не принадлежит выбранной машине';
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
      raise exception 'Количество списания должно быть больше нуля';
    end if;

    perform 1 from public.consumables
    where id = item.consumable_id and is_active = true and organization_id = v_org_id
    for update;
    if not found then
      raise exception 'Расходник % не найден или удалён со склада', item.consumable_id;
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
    raise exception 'Требуется авторизация';
  end if;

  v_org_id := public.current_org_id();
  if v_org_id is null then
    raise exception 'Пользователь не привязан ни к одной организации';
  end if;

  perform 1 from public.calls
  where id = p_call_id and organization_id = v_org_id and (user_id = auth.uid() or public.is_admin())
  for update;
  if not found then
    raise exception 'Вызов не найден или недостаточно прав';
  end if;

  if not exists (
    select 1 from public.bags
    where id = p_bag_id and vehicle_id = p_vehicle_id and organization_id = v_org_id
  ) then
    raise exception 'Сумка не принадлежит выбранной машине';
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
      raise exception 'Количество списания должно быть больше нуля';
    end if;

    perform 1 from public.consumables
    where id = item.consumable_id and organization_id = v_org_id
    for update;
    if not found then
      raise exception 'Расходник % не найден', item.consumable_id;
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
    raise exception 'Требуется авторизация';
  end if;

  v_org_id := public.current_org_id();
  if v_org_id is null then
    raise exception 'Пользователь не привязан ни к одной организации';
  end if;

  perform 1 from public.calls
  where id = p_call_id and organization_id = v_org_id and (user_id = auth.uid() or public.is_admin())
  for update;
  if not found then
    raise exception 'Вызов не найден или недостаточно прав';
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
    where id = p_consumable_id and is_active = true and organization_id = public.current_org_id()
  ) then
    raise exception 'Позиция не найдена или удалена со склада';
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
    raise exception 'Удалять позиции со склада может только администратор';
  end if;

  update public.consumables
  set is_active = false
  where id = p_consumable_id and is_active = true and organization_id = public.current_org_id();

  if not found then
    raise exception 'Позиция не найдена или уже удалена';
  end if;
end;
$$;

-- adjust_stock не меняется: он не выдан authenticated напрямую (revoke all ... from public
-- в 202607160000), вызывается только из функций выше, которые уже проверили организацию.

notify pgrst, 'reload schema';
