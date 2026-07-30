-- Мультитенантность, шаг 6: RLS-политики теперь ограничивают доступ организацией
-- вызывающего (current_org_id()), а не "все авторизованные видят всё".

-- users
drop policy if exists "Authenticated users can read users" on public.users;
create policy "Authenticated users can read users" on public.users
  for select to authenticated using (organization_id = public.current_org_id());

drop policy if exists "Authenticated users can update own profile" on public.users;
create policy "Authenticated users can update own profile" on public.users
  for update to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id and organization_id = public.current_org_id());

-- vehicles
drop policy if exists "Authenticated read vehicles" on public.vehicles;
create policy "Authenticated read vehicles" on public.vehicles
  for select to authenticated using (organization_id = public.current_org_id());

-- bags
drop policy if exists "Authenticated read bags" on public.bags;
create policy "Authenticated read bags" on public.bags
  for select to authenticated using (organization_id = public.current_org_id());

-- consumables
drop policy if exists "Authenticated read consumables" on public.consumables;
create policy "Authenticated read consumables" on public.consumables
  for select to authenticated using (organization_id = public.current_org_id());

drop policy if exists "Admins insert consumables" on public.consumables;
create policy "Admins insert consumables" on public.consumables
  for insert to authenticated
  with check (public.is_admin() and organization_id = public.current_org_id());

drop policy if exists "Admins update consumables" on public.consumables;
create policy "Admins update consumables" on public.consumables
  for update to authenticated
  using (public.is_admin() and organization_id = public.current_org_id())
  with check (public.is_admin() and organization_id = public.current_org_id());

-- calls
drop policy if exists "Authenticated read calls" on public.calls;
create policy "Authenticated read calls" on public.calls
  for select to authenticated using (organization_id = public.current_org_id());

drop policy if exists "Authenticated insert own calls" on public.calls;
create policy "Authenticated insert own calls" on public.calls
  for insert to authenticated
  with check (user_id = auth.uid() and organization_id = public.current_org_id());

drop policy if exists "Owners or admins update calls" on public.calls;
create policy "Owners or admins update calls" on public.calls
  for update to authenticated
  using (organization_id = public.current_org_id() and (user_id = auth.uid() or public.is_admin()))
  with check (organization_id = public.current_org_id() and (user_id = auth.uid() or public.is_admin()));

drop policy if exists "Owners or admins delete calls" on public.calls;
create policy "Owners or admins delete calls" on public.calls
  for delete to authenticated
  using (organization_id = public.current_org_id() and (user_id = auth.uid() or public.is_admin()));

-- writeoffs
drop policy if exists "Authenticated read writeoffs" on public.writeoffs;
create policy "Authenticated read writeoffs" on public.writeoffs
  for select to authenticated using (organization_id = public.current_org_id());

drop policy if exists "Authenticated insert own writeoffs" on public.writeoffs;
create policy "Authenticated insert own writeoffs" on public.writeoffs
  for insert to authenticated
  with check (user_id = auth.uid() and organization_id = public.current_org_id());

drop policy if exists "Owners or admins delete writeoffs" on public.writeoffs;
create policy "Owners or admins delete writeoffs" on public.writeoffs
  for delete to authenticated
  using (organization_id = public.current_org_id() and (user_id = auth.uid() or public.is_admin()));

-- stock_movements
drop policy if exists "Authenticated read stock movements" on public.stock_movements;
create policy "Authenticated read stock movements" on public.stock_movements
  for select to authenticated using (organization_id = public.current_org_id());

-- organizations: пользователь видит только свою собственную организацию.
drop policy if exists "Users read own organization" on public.organizations;
create policy "Users read own organization" on public.organizations
  for select to authenticated using (id = public.current_org_id());
