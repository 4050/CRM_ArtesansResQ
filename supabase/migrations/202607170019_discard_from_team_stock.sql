-- Write off stock from the team without returning it to the main warehouse
-- (lost, damaged, expired while with the team) - unlike
-- return_from_team_stock, the main warehouse is untouched. Automatically
-- logged by the existing log_team_stock_movement trigger.
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
