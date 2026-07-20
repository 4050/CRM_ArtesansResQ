-- Даём админу редактировать и "удалять" (мягко, через is_active) машины и
-- сумки — по аналогии с consumables. У bags раньше не было is_active вообще,
-- добавляем колонку, чтобы удаление не било по calls.bag_id (там нет
-- on delete cascade, поэтому жёсткий delete падал бы на используемых сумках).

alter table public.bags add column if not exists is_active boolean not null default true;

drop policy if exists "Admins update vehicles" on public.vehicles;
create policy "Admins update vehicles" on public.vehicles
  for update to authenticated
  using (public.is_admin() and organization_id = public.current_org_id())
  with check (public.is_admin() and organization_id = public.current_org_id());

drop policy if exists "Admins update bags" on public.bags;
create policy "Admins update bags" on public.bags
  for update to authenticated
  using (public.is_admin() and organization_id = public.current_org_id())
  with check (public.is_admin() and organization_id = public.current_org_id());

create or replace function public.archive_vehicle(p_vehicle_id uuid)
returns void
language plpgsql
security definer set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Удалять машины может только администратор';
  end if;

  update public.vehicles
  set is_active = false
  where id = p_vehicle_id and is_active = true and organization_id = public.current_org_id();

  if not found then
    raise exception 'Машина не найдена или уже удалена';
  end if;
end;
$$;

revoke all on function public.archive_vehicle(uuid) from public;
grant execute on function public.archive_vehicle(uuid) to authenticated;

create or replace function public.archive_bag(p_bag_id uuid)
returns void
language plpgsql
security definer set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Удалять сумки может только администратор';
  end if;

  update public.bags
  set is_active = false
  where id = p_bag_id and is_active = true and organization_id = public.current_org_id();

  if not found then
    raise exception 'Сумка не найдена или уже удалена';
  end if;
end;
$$;

revoke all on function public.archive_bag(uuid) from public;
grant execute on function public.archive_bag(uuid) to authenticated;
