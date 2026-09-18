-- Excel-импорт отклонял целиком строки с количеством 0 ("Quantity must be
-- a positive number") - но 0 остатка на складе - легитимное состояние
-- (qty_in_stock уже допускает check (qty_in_stock >= 0) для любой другой
-- операции), встреченное в реальном файле поставки: позиция известна и
-- отслеживается, просто сейчас её нет в наличии. Ослабляем проверку до
-- ">= 0", как уже сделано для qty_minimum ниже в этой же функции.
--
-- Рестоки (p_to_restock) не трогаем - добавление 0 к уже существующему
-- остатку бессмысленно (no-op), и об этом отдельно не просили.

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
    if item.quantity is null or item.quantity < 0 then
      raise exception 'Quantity must be zero or a positive number';
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
