-- Клиент дёргает touch_last_seen() раз в минуту, пока смонтирован
-- защищённый layout (components/layout/Heartbeat.tsx), и /{lang}/users
-- считает пользователя online, если last_seen_at не старше порога.
alter table public.users add column last_seen_at timestamptz;

-- security definer, а не обновление через "Authenticated users can update
-- own profile" (schema.sql) - тот policy своим with-check (role/org не
-- меняются) защищает привилегии на изменяемой самим пользователем
-- строке, а не то, от чего должен зависеть этот однострочный пинг.
create or replace function public.touch_last_seen()
returns void
language plpgsql
security definer set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  update public.users set last_seen_at = now() where id = auth.uid();
end;
$$;

revoke all on function public.touch_last_seen() from public;
grant execute on function public.touch_last_seen() to authenticated;
