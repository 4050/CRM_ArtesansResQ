-- Полный сброс операционных данных перед запуском в бой: удаляет ВСЕ
-- вызовы (calls) вместе с их списаниями (writeoffs), ВСЕ позиции склада
-- (consumables) вместе с остатками у бригад (team_stock), и весь журнал
-- движений (stock_movements). Организации, пользователей, машины и сумки
-- НЕ трогает.
--
-- Запускать вручную через Supabase SQL Editor. Само приложение такой
-- возможности не даёт - это разовая ручная операция.
-- ВАЖНО: действие необратимо. Сначала прогоните шаг 1-2 (просмотр),
-- и только потом раскомментируйте блок удаления в шаге 3.

-- 1. Посмотреть organization_id нужной организации:
select id, name from public.organizations;

-- 2. Проверить, сколько строк попадёт под удаление, ПЕРЕД удалением
--    (подставьте id из шага 1):
select
  (select count(*) from public.calls where organization_id = '<organization-id>') as calls,
  (select count(*) from public.writeoffs where organization_id = '<organization-id>') as writeoffs,
  (select count(*) from public.consumables where organization_id = '<organization-id>') as consumables,
  (select count(*) from public.team_stock where organization_id = '<organization-id>') as team_stock,
  (select count(*) from public.stock_movements where organization_id = '<organization-id>') as stock_movements;

-- 3. Само удаление. Порядок важен из-за foreign key:
--    - удаление calls каскадно удаляет их writeoffs
--      (writeoffs.call_id ... on delete cascade)
--    - удаление consumables каскадно удаляет team_stock
--      (team_stock.consumable_id ... on delete cascade)
--    - stock_movements удаляется отдельно (от неё ничего не зависит)
--    Обёрнуто в транзакцию - либо применится всё, либо ничего.
--
-- Раскомментируйте блок целиком и замените '<organization-id>' везде на
-- реальный id.

-- begin;

-- delete from public.calls
-- where organization_id = '<organization-id>';

-- delete from public.consumables
-- where organization_id = '<organization-id>';

-- delete from public.stock_movements
-- where organization_id = '<organization-id>';

-- commit;

-- 4. После удаления - проверить, что всё действительно пусто:
-- select
--   (select count(*) from public.calls where organization_id = '<organization-id>') as calls,
--   (select count(*) from public.writeoffs where organization_id = '<organization-id>') as writeoffs,
--   (select count(*) from public.consumables where organization_id = '<organization-id>') as consumables,
--   (select count(*) from public.team_stock where organization_id = '<organization-id>') as team_stock,
--   (select count(*) from public.stock_movements where organization_id = '<organization-id>') as stock_movements;
