-- "Admins update consumables" разрешает прямой UPDATE всей строки в обход
-- adjust_stock(), а до этой миграции ничто на уровне БД не мешало выставить
-- qty_in_stock/qty_minimum в отрицательное значение таким прямым обновлением.
-- adjust_stock() свою проверку уже делал, но только для своего собственного
-- пути записи — теперь ограничение действует независимо от того, кто и как
-- пишет в таблицу.

alter table public.consumables add constraint consumables_qty_in_stock_nonneg check (qty_in_stock >= 0);
alter table public.consumables add constraint consumables_qty_minimum_nonneg check (qty_minimum >= 0);
