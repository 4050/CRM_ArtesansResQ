-- Lets an admin remove an item from the team-stock list entirely, once its
-- quantity has been brought back to zero via return_from_team_stock or
-- discard_from_team_stock. Blocking the delete while qty_in_stock > 0 is
-- the answer to "what if there's still stock there when you delete it?" -
-- a bare DELETE would make that stock vanish from every screen with no
-- movement logged (log_team_stock_movement only fires on qty changes, not
-- on delete), so the admin is forced to explicitly return-to-main or
-- discard the remainder first - both already logged - before the row can
-- go away. Deleting is safe/reversible either way: adjust_team_stock
-- recreates the row the next time this item is issued to the team again.
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
