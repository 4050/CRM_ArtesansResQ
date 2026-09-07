-- One-shot deploy snapshot: concatenates the 5 migrations added on
-- 2026-09-05/07 (202609050001, 202609050002, 202609070001, 202609070002,
-- 202609070003 - see supabase/migrations/), for pasting into the Supabase
-- SQL Editor in one go against an existing project that's already caught
-- up through 202608260001.
--
-- This is a convenience snapshot, not a source of truth - the individual
-- files under supabase/migrations/ are canonical (and are what
-- npm run check:schema validates against schema.sql). Every statement
-- here is idempotent (create or replace function / revoke+grant), so
-- re-running it is safe, but it will drift out of date as new migrations
-- land. Safe to delete once every deployed project is caught up.

-- === 202609050001_guard_null_consumable_return.sql ===

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

-- === 202609050002_adjust_stock_friendly_error.sql ===

-- Баг: adjust_stock() (главный склад) проверяло "хватает ли" уже ПОСЛЕ
-- update - но consumables.qty_in_stock имеет check (qty_in_stock >= 0), и
-- сам update, толкающий его в минус, падает с сырой ошибкой нарушения
-- констрейнта раньше, чем функция успевает дойти до своей проверки и
-- бросить дружелюбное сообщение. adjust_team_stock() (склад команды) уже
-- решает это правильно - guard прямо в WHERE самого update; переносим тот
-- же приём сюда.

create or replace function public.adjust_stock(p_consumable_id uuid, p_delta integer)
returns public.consumables
language plpgsql
security definer set search_path = ''
as $$
declare
  updated public.consumables;
  current_qty integer;
  item_name text;
begin
  -- The qty_in_stock + p_delta >= 0 guard belongs in the UPDATE's WHERE
  -- clause, not as a check on the result afterwards - consumables.qty_in_stock
  -- has a "check (qty_in_stock >= 0)" constraint (see schema.sql's create
  -- table), so an UPDATE that would drive it negative fails outright with a
  -- raw constraint-violation error before this function ever gets to raise
  -- its own friendlier one. Same fix already applied to adjust_team_stock's
  -- equivalent guard.
  update public.consumables
  set qty_in_stock = qty_in_stock + p_delta
  where id = p_consumable_id and qty_in_stock + p_delta >= 0
  returning * into updated;

  if found then
    return updated;
  end if;

  select qty_in_stock, name into current_qty, item_name
  from public.consumables where id = p_consumable_id;

  if current_qty is null then
    raise exception 'Consumable % not found', p_consumable_id;
  end if;

  raise exception 'Not enough "%" in stock (in stock: %, requested: %)',
    item_name, current_qty, -p_delta;
end;
$$;

revoke all on function public.adjust_stock(uuid, integer) from public;

-- === 202609070002_writeoffs_total_since_rpc.sql ===

-- Баг: dashboard'ская карточка "списано сегодня" тянула КАЖДУЮ строку
-- списания за сегодня (lib/data/writeoffs.ts's getWriteoffsSince) и
-- суммировала их в JS - без собственного лимита. PostgREST по умолчанию
-- режет выдачу на 1000 строк, так что при достаточно активном дне итог
-- тихо занижался бы. writeoffs_report уже решает эту же задачу агрегацией
-- прямо в SQL (см. 202608190002) - тот же приём здесь.

create or replace function public.writeoffs_total_since(p_since timestamptz)
returns integer
language sql
stable
set search_path = ''
as $$
  select coalesce(sum(quantity), 0)::integer
  from public.writeoffs
  where organization_id = public.current_org_id()
    and created_at >= p_since;
$$;

revoke all on function public.writeoffs_total_since(timestamptz) from public;
grant execute on function public.writeoffs_total_since(timestamptz) to authenticated;

-- === 202609070003_confirm_inventory_import_rpc.sql ===

-- Excel-импорт склада применялся не атомарно: новые позиции создавались
-- одним запросом, а рестоки существующих шли отдельным циклом,
-- вызывающим restock_consumable по одной строке за раз. При сбое
-- посередине часть данных уже сохранена, а потерянный ответ (обрыв сети)
-- не даёт клиенту способа надёжно повторить операцию, не рискуя задвоить
-- уже применённый рестok.
--
-- confirm_inventory_import оборачивает и создание, и рестоки в одну
-- транзакцию (весь plpgsql-вызов) - любая проблемная строка (нет кода/
-- имени, некорректное количество, дубликат кода, удалённый расходник)
-- откатывает импорт целиком, и вызывающая сторона получает одну понятную
-- ошибку вместо частично применённого состояния.

create or replace function public.confirm_inventory_import(p_to_create jsonb, p_to_restock jsonb)
returns jsonb
language plpgsql
security definer set search_path = ''
as $$
declare
  item record;
  new_row public.consumables;
  restocked_row public.consumables;
  created_rows jsonb := '[]'::jsonb;
  restocked_rows jsonb := '[]'::jsonb;
begin
  if not public.is_admin() then
    raise exception 'Only an administrator can import inventory';
  end if;

  for item in
    select *
    from jsonb_to_recordset(coalesce(p_to_create, '[]'::jsonb)) as x(
      code text, name text, category text, unit text,
      quantity integer, qty_minimum integer, description text
    )
  loop
    if item.code is null or trim(item.code) = '' then
      raise exception 'Missing code';
    end if;
    if item.name is null or trim(item.name) = '' then
      raise exception 'Missing name';
    end if;
    if item.quantity is null or item.quantity <= 0 then
      raise exception 'Quantity must be a positive number';
    end if;
    if item.qty_minimum is null or item.qty_minimum < 0 then
      raise exception 'Minimum stock must be zero or a positive number';
    end if;

    insert into public.consumables (code, name, category, unit, qty_in_stock, qty_minimum, description, organization_id)
    values (
      item.code, item.name, coalesce(item.category, 'other'), coalesce(item.unit, 'pcs'),
      item.quantity, item.qty_minimum, item.description, public.current_org_id()
    )
    returning * into new_row;

    created_rows := created_rows || jsonb_build_array(to_jsonb(new_row));
  end loop;

  for item in
    select *
    from jsonb_to_recordset(coalesce(p_to_restock, '[]'::jsonb)) as x(consumable_id uuid, quantity integer)
  loop
    if item.quantity is null or item.quantity <= 0 then
      raise exception 'Restock quantity must be a positive number';
    end if;

    -- Reuses restock_consumable's own admin/existence checks and its call
    -- to adjust_stock - same rules, one implementation.
    restocked_row := public.restock_consumable(item.consumable_id, item.quantity);
    restocked_rows := restocked_rows || jsonb_build_array(to_jsonb(restocked_row));
  end loop;

  return jsonb_build_object('created', created_rows, 'restocked', restocked_rows);
end;
$$;

revoke all on function public.confirm_inventory_import(jsonb, jsonb) from public;
grant execute on function public.confirm_inventory_import(jsonb, jsonb) to authenticated;
