-- Admins (and master_admin, which is_admin() already covers) can now hard
-- delete an inventory item, not just archive it — mirrors delete_vehicle /
-- delete_bag. Blocked by a plain foreign_key_violation if write-offs or
-- stock movements still reference the item, same pattern as those two.
create or replace function public.delete_consumable(p_consumable_id uuid)
returns void
language plpgsql
security definer set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Only an administrator can delete inventory items';
  end if;

  delete from public.consumables
  where id = p_consumable_id and organization_id = public.current_org_id();

  if not found then
    raise exception 'Item not found';
  end if;
exception
  when foreign_key_violation then
    raise exception 'Cannot delete item: write-offs or stock movements still reference it. Deactivate it first.';
end;
$$;

revoke all on function public.delete_consumable(uuid) from public;
grant execute on function public.delete_consumable(uuid) to authenticated;
