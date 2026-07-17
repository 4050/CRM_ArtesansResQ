-- Закрываем эскалацию привилегий: политика "update own profile" разрешала
-- менять любую колонку своей строки, включая role, поэтому медик мог сам
-- назначить себе role = 'admin'. Теперь role обязан совпадать с уже
-- сохранённым значением (сравнение идёт с состоянием строки до UPDATE в
-- рамках снапшота команды, как и current_org_id() ниже для organization_id).

drop policy if exists "Authenticated users can update own profile" on public.users;
create policy "Authenticated users can update own profile" on public.users
  for update to authenticated
  using (auth.uid() = id)
  with check (
    auth.uid() = id
    and organization_id = public.current_org_id()
    and role = (select u.role from public.users u where u.id = auth.uid())
  );
