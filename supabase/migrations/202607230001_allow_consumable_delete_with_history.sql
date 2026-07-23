-- Lets an admin fully delete a consumable even once write-offs or stock
-- movements reference it, instead of forcing a deactivate-only dead end.
-- Historical rows are kept, not cascaded away - their consumable_id is set
-- to null, and reports/movements already render that gracefully (the "—"
-- fallbacks in movements/writeoffs, dict.reports.deletedItem in the reports
-- breakdown) since a joined consumable was always nullable there for the
-- ordinary "item deactivated" case.
--
-- team_stock is deliberately left alone (still `on delete cascade`, see
-- 202607170015): unlike a write-off/movement row, it has no other identity
-- besides the consumable it's for, and cascading it away while
-- qty_in_stock > 0 would silently drop stock the team is still physically
-- holding, with nothing logged (same problem solved for
-- delete_team_stock_item in 202607220003). So delete_consumable below
-- explicitly checks for that and refuses instead.

alter table public.writeoffs
  drop constraint writeoffs_consumable_id_fkey,
  add constraint writeoffs_consumable_id_fkey
    foreign key (consumable_id) references public.consumables(id) on delete set null;

alter table public.stock_movements
  alter column consumable_id drop not null;
alter table public.stock_movements
  drop constraint stock_movements_consumable_id_fkey,
  add constraint stock_movements_consumable_id_fkey
    foreign key (consumable_id) references public.consumables(id) on delete set null;

create or replace function public.delete_consumable(p_consumable_id uuid)
returns void
language plpgsql
security definer set search_path = ''
as $$
declare
  team_qty integer;
begin
  if not public.is_admin() then
    raise exception 'Only an administrator can delete inventory items';
  end if;

  select qty_in_stock into team_qty
  from public.team_stock
  where consumable_id = p_consumable_id and organization_id = public.current_org_id();

  if team_qty is not null and team_qty > 0 then
    raise exception 'This item still has % unit(s) in team stock - return or discard it there first', team_qty;
  end if;

  delete from public.consumables
  where id = p_consumable_id and organization_id = public.current_org_id();

  if not found then
    raise exception 'Item not found';
  end if;
end;
$$;

revoke all on function public.delete_consumable(uuid) from public;
grant execute on function public.delete_consumable(uuid) to authenticated;
