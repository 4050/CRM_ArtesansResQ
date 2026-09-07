-- Баг: update_call_with_writeoffs удаляло ВСЕ списания вызова и заново
-- вставляло их из p_writeoffs, даже когда менялось только описание/дата/
-- машина/сумка самого вызова. Это меняло user_id/created_at на редактора и
-- "сейчас" у КАЖДОЙ позиции - искажая исторические отчёты о том, кто что
-- списал - и порождало фантомную пару "возврат + повторная выдача" в
-- stock_movements на каждую позицию, даже если её количество не менялось.
--
-- Фикс: сравниваем текущий набор списаний с новым по consumable_id
-- (на вызов всегда не больше одной строки на consumable_id - и эта
-- функция, и create_call_with_writeoffs группируют перед записью):
--   - позиция пропала -> вернуть остаток, удалить строку;
--   - позиция новая -> списать, вставить с user_id/created_at редактора;
--   - позиция осталась, количество изменилось -> скорректировать только
--     дельту, user_id/created_at не трогать;
--   - позиция осталась без изменений -> вообще не трогать.

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
  v_old_qty integer;
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

  update public.calls
  set date = p_date,
      description = nullif(trim(p_description), ''),
      vehicle_id = p_vehicle_id,
      bag_id = p_bag_id
  where id = p_call_id and organization_id = v_org_id;

  -- Diff the existing write-offs against the incoming set by consumable_id
  -- (each call has at most one row per consumable_id - both this function
  -- and create_call_with_writeoffs always group/dedupe before touching the
  -- table) instead of unconditionally deleting and re-inserting everything.
  -- A blanket delete+recreate reset every surviving line's user_id/created_at
  -- to the editor and "now", even when only the call's own date/description/
  -- vehicle/bag changed - misattributing history to whoever last edited it -
  -- and generated a phantom return-then-reissue stock_movements pair for
  -- every item, even ones whose quantity never changed. See 202609070001.

  -- Removed: an existing line whose consumable_id isn't in the new set.
  -- (A deleted consumable's line - consumable_id nulled by "on delete set
  -- null", see 202607230001 - always lands here too: the client can never
  -- put a deleted consumable's id back in p_writeoffs, and there's nothing
  -- to return to team_stock for it anyway, since team_stock's own row was
  -- cascade-deleted alongside the consumable - same guard as before.)
  for item in
    select w.id, w.consumable_id, w.quantity
    from public.writeoffs w
    where w.call_id = p_call_id and w.organization_id = v_org_id
      and not exists (
        select 1
        from jsonb_to_recordset(coalesce(p_writeoffs, '[]'::jsonb)) as x(consumable_id uuid, quantity integer)
        where x.consumable_id = w.consumable_id
      )
  loop
    if item.consumable_id is not null then
      perform public.adjust_team_stock(item.consumable_id, item.quantity);
    end if;
    delete from public.writeoffs where id = item.id;
  end loop;

  -- New or changed: every consumable_id present in the incoming set,
  -- compared against its existing line (if any).
  for item in
    select x.consumable_id, sum(x.quantity)::integer as quantity
    from jsonb_to_recordset(coalesce(p_writeoffs, '[]'::jsonb)) as x(consumable_id uuid, quantity integer)
    group by x.consumable_id
  loop
    if item.quantity <= 0 then
      raise exception 'Write-off quantity must be greater than zero';
    end if;

    perform 1 from public.consumables where id = item.consumable_id and organization_id = v_org_id for update;
    if not found then
      raise exception 'Consumable % not found', item.consumable_id;
    end if;

    select w.quantity into v_old_qty
    from public.writeoffs w
    where w.call_id = p_call_id and w.organization_id = v_org_id and w.consumable_id = item.consumable_id;

    if v_old_qty is null then
      -- A genuinely new line - attributed to whoever is editing now, same
      -- as create_call_with_writeoffs attributes a new call's own lines.
      perform public.adjust_team_stock(item.consumable_id, -item.quantity);
      insert into public.writeoffs (call_id, consumable_id, quantity, user_id, organization_id)
      values (p_call_id, item.consumable_id, item.quantity, auth.uid(), v_org_id);
    elsif v_old_qty <> item.quantity then
      -- Quantity changed on an existing line - adjust team_stock by only
      -- the delta and update the row in place, leaving its original
      -- user_id/created_at untouched (a quantity edit isn't a new
      -- write-off event).
      perform public.adjust_team_stock(item.consumable_id, v_old_qty - item.quantity);
      update public.writeoffs
      set quantity = item.quantity
      where call_id = p_call_id and organization_id = v_org_id and consumable_id = item.consumable_id;
    end if;
    -- else: unchanged - nothing to touch.
  end loop;
end;
$$;

revoke all on function public.update_call_with_writeoffs(uuid, timestamptz, text, uuid, uuid, jsonb) from public;
grant execute on function public.update_call_with_writeoffs(uuid, timestamptz, text, uuid, uuid, jsonb) to authenticated;
