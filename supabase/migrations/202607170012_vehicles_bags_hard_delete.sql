-- Раньше "удалить" машину/сумку означало только is_active = false
-- (archive_vehicle/archive_bag). Добавляем отдельное безвозвратное удаление —
-- две разные операции с разным смыслом, а не одна кнопка.

create or replace function public.delete_vehicle(p_vehicle_id uuid)
returns void
language plpgsql
security definer set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Удалять машины может только администратор';
  end if;

  delete from public.vehicles
  where id = p_vehicle_id and organization_id = public.current_org_id();

  if not found then
    raise exception 'Машина не найдена';
  end if;
exception
  when foreign_key_violation then
    raise exception 'Нельзя удалить машину: за ней закреплены сумки или вызовы. Сначала переведите её в неактивные.';
end;
$$;

revoke all on function public.delete_vehicle(uuid) from public;
grant execute on function public.delete_vehicle(uuid) to authenticated;

create or replace function public.delete_bag(p_bag_id uuid)
returns void
language plpgsql
security definer set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Удалять сумки может только администратор';
  end if;

  delete from public.bags
  where id = p_bag_id and organization_id = public.current_org_id();

  if not found then
    raise exception 'Сумка не найдена';
  end if;
exception
  when foreign_key_violation then
    raise exception 'Нельзя удалить сумку: на неё ссылаются вызовы. Сначала переведите её в неактивные.';
end;
$$;

revoke all on function public.delete_bag(uuid) from public;
grant execute on function public.delete_bag(uuid) to authenticated;
