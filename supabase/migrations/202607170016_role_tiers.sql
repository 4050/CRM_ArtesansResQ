-- Третий уровень доступа: master_admin (всё, что может admin, плюс
-- назначение ролей admin/medic другим сотрудникам организации из
-- приложения — без ручного SQL Editor для каждого последующего изменения
-- роли; самый первый master_admin организации по-прежнему заводится через
-- SQL Editor, как и первый admin раньше).

-- Ищем текущее check-ограничение на users.role динамически — не полагаемся
-- на предполагаемое автосгенерированное имя (тот же приём, что и для
-- unique-ограничений в 202607170004_multitenancy_enforce.sql).
do $$
declare
  c record;
begin
  for c in
    select conname
    from pg_constraint
    where conrelid = 'public.users'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) like '%role%'
  loop
    execute format('alter table public.users drop constraint %I', c.conname);
  end loop;
end $$;
alter table public.users add constraint users_role_check check (role in ('master_admin', 'admin', 'medic'));

-- master_admin имеет все права admin — расширяем эту одну функцию, и это
-- автоматически распространяется на все существующие admin-gated
-- политики/RPC, которые её вызывают, без правки каждой по отдельности.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer set search_path = ''
as $$
  select exists (
    select 1 from public.users
    where id = auth.uid() and role in ('admin', 'master_admin')
  );
$$;

create or replace function public.is_master_admin()
returns boolean
language sql
stable
security definer set search_path = ''
as $$
  select exists (
    select 1 from public.users
    where id = auth.uid() and role = 'master_admin'
  );
$$;

-- Назначение ролей — только master_admin, и только admin/medic в качестве
-- цели. Менять собственную роль через этот путь нельзя.
create or replace function public.set_user_role(p_user_id uuid, p_role text)
returns void
language plpgsql
security definer set search_path = ''
as $$
begin
  if not public.is_master_admin() then
    raise exception 'Only a master admin can change user roles';
  end if;
  if p_role not in ('admin', 'medic') then
    raise exception 'Role must be admin or medic';
  end if;
  if p_user_id = auth.uid() then
    raise exception 'You cannot change your own role';
  end if;

  update public.users
  set role = p_role
  where id = p_user_id and organization_id = public.current_org_id();

  if not found then
    raise exception 'User not found in your organization';
  end if;
end;
$$;

revoke all on function public.set_user_role(uuid, text) from public;
grant execute on function public.set_user_role(uuid, text) to authenticated;
