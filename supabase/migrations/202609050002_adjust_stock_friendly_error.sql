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
