-- Баг: у update_call_with_writeoffs/delete_call_with_writeoffs цикл возврата
-- остатка группирует списания по consumable_id, включая NULL (у списания
-- уже удалённого расходника - см. 202607230001_allow_consumable_delete_
-- with_history.sql, consumable_id зануляется on delete set null). Передача
-- NULL в adjust_team_stock() падала с ошибкой NOT NULL constraint на
-- team_stock.consumable_id/organization_id - в итоге любой вызов,
-- содержащий списание удалённого расходника, было невозможно ни
-- отредактировать, ни удалить через обычный UI.
--
-- Фикс: пропускать группу с consumable_id is null - возвращать в
-- team_stock всё равно нечего (строка team_stock того расходника уже
-- каскадно удалена вместе с ним самим).

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

revoke all on function public.update_call_with_writeoffs(uuid, timestamptz, text, uuid, uuid, jsonb) from public;
revoke all on function public.delete_call_with_writeoffs(uuid) from public;
grant execute on function public.update_call_with_writeoffs(uuid, timestamptz, text, uuid, uuid, jsonb) to authenticated;
grant execute on function public.delete_call_with_writeoffs(uuid) to authenticated;
