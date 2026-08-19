-- Разовая очистка журнала движений склада (public.stock_movements).
-- Запускать вручную через Supabase SQL Editor. Само приложение такой
-- возможности не даёт — это только для ручного обслуживания, история
-- движений считается неизменяемым аудиторским логом.
--
-- ВАЖНО: действие необратимо. Перед запуском сверьте organization_id.

-- 1. Посмотреть organization_id нужной организации:
-- select id, name from public.organizations;

-- 2. Проверить, сколько строк попадёт под удаление, ПЕРЕД удалением:
select count(*)
from public.stock_movements
where organization_id = '<organization-id>';
-- и/или с диапазоном дат:
-- where organization_id = '<organization-id>'
--   and created_at < '2026-01-01';

-- 3. Само удаление — раскомментируйте нужный вариант и замените id/дату.

-- Вариант А: удалить всю историю движений организации целиком
-- delete from public.stock_movements
-- where organization_id = '<organization-id>';

-- Вариант Б: удалить только движения старше указанной даты
-- delete from public.stock_movements
-- where organization_id = '<organization-id>'
--   and created_at < '2026-01-01';
