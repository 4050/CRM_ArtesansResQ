-- Мастер-админ: возможность ограничивать доступ учётной записи (не удаляя
-- её) и полностью удалять пользователей своей организации.
--
-- "Ограничение доступа" сделано в двух слоях - то же расслоение, что уже
-- есть для is_admin()/is_master_admin() (см. 202607170008):
--   1) auth-уровень: аккаунт банят через Supabase Auth Admin API
--      (ban_duration) из серверного экшена - это блокирует новый вход и
--      обновление refresh-токена (см. app/[lang]/(app)/users/actions.ts).
--   2) DB-уровень, мгновенно, не дожидаясь протухания уже выданного
--      access-токена: current_org_id() - центральная точка, которую
--      проверяют почти все RLS-политики и default для organization_id при
--      insert'ах - теперь дополнительно требует is_active. Одна правка
--      этой функции автоматически распространяется на всё, что её уже
--      использует, тем же приёмом, что и расширение is_admin() в 202607170008.
--
-- is_active - зеркальная колонка в public.users: единственный источник
-- истины для реального бана - auth.users (через Admin API), эта колонка
-- нужна только чтобы страница мастер-админа могла показать статус без
-- отдельного вызова Admin API на каждый рендер. Меняет её только серверный
-- экшен, синхронно с самим баном, так что расхождения не возникает.
alter table public.users add column if not exists is_active boolean not null default true;

create or replace function public.current_org_id()
returns uuid
language sql
stable
security definer set search_path = ''
as $$
  select organization_id from public.users where id = auth.uid() and is_active;
$$;

-- Удаление пользователя идёт через Auth Admin API (supabase.auth.admin.
-- deleteUser) - он каскадно удаляет строку public.users (users.id ->
-- auth.users.id on delete cascade). А вот исторические calls/writeoffs/
-- stock_movements этого пользователя должны остаться, а не пропасть или
-- заблокировать удаление ошибкой внешнего ключа - тот же приём, что уже
-- применён к consumable_id в 202607230001_allow_consumable_delete_with_
-- history.sql. Рендер уже готов к null user: calls/writeoffs показывают
-- '—', movements - dict.movements.system.
alter table public.calls
  drop constraint calls_user_id_fkey,
  add constraint calls_user_id_fkey
    foreign key (user_id) references public.users(id) on delete set null;

alter table public.writeoffs
  drop constraint writeoffs_user_id_fkey,
  add constraint writeoffs_user_id_fkey
    foreign key (user_id) references public.users(id) on delete set null;

alter table public.stock_movements
  drop constraint stock_movements_user_id_fkey,
  add constraint stock_movements_user_id_fkey
    foreign key (user_id) references public.users(id) on delete set null;
