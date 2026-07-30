-- Раньше машины и сумки заводились только вручную через SQL Editor (см.
-- README). Даём админу заводить их прямо из приложения — по аналогии с тем,
-- как уже устроено для consumables.

alter table public.vehicles alter column organization_id set default public.current_org_id();
alter table public.bags alter column organization_id set default public.current_org_id();

drop policy if exists "Admins insert vehicles" on public.vehicles;
create policy "Admins insert vehicles" on public.vehicles
  for insert to authenticated
  with check (public.is_admin() and organization_id = public.current_org_id());

drop policy if exists "Admins insert bags" on public.bags;
create policy "Admins insert bags" on public.bags
  for insert to authenticated
  with check (public.is_admin() and organization_id = public.current_org_id());
