-- Lets an admin/master_admin correct an accidental issue by moving stock
-- back from team_stock to the main warehouse. Mirrors transfer_to_team_stock
-- in reverse; does not require the consumable to be is_active, since the
-- item may have been archived after the mistaken issue but the correction
-- still needs to go through.
create or replace function public.return_from_team_stock(p_consumable_id uuid, p_quantity integer)
returns public.team_stock
language plpgsql
security definer set search_path = ''
as $$
declare
  updated public.team_stock;
begin
  if not public.is_admin() then
    raise exception 'Only an administrator can return stock from the team';
  end if;
  if p_quantity <= 0 then
    raise exception 'Return quantity must be greater than zero';
  end if;
  if not exists (
    select 1 from public.consumables
    where id = p_consumable_id and organization_id = public.current_org_id()
  ) then
    raise exception 'Item not found';
  end if;

  updated := public.adjust_team_stock(p_consumable_id, -p_quantity);
  perform public.adjust_stock(p_consumable_id, p_quantity);
  return updated;
end;
$$;

revoke all on function public.return_from_team_stock(uuid, integer) from public;
grant execute on function public.return_from_team_stock(uuid, integer) to authenticated;
