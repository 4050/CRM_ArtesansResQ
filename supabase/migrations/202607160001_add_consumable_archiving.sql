alter table public.consumables
add column if not exists is_active boolean not null default true;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer set search_path = ''
as $$
  select exists (
    select 1 from public.users
    where id = auth.uid() and role = 'admin'
  );
$$;

create or replace function public.archive_consumable(p_consumable_id uuid)
returns void
language plpgsql
security definer set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Удалять позиции со склада может только администратор';
  end if;

  update public.consumables
  set is_active = false
  where id = p_consumable_id and is_active = true;

  if not found then
    raise exception 'Позиция не найдена или уже удалена';
  end if;
end;
$$;

revoke all on function public.archive_consumable(uuid) from public;
grant execute on function public.archive_consumable(uuid) to authenticated;
