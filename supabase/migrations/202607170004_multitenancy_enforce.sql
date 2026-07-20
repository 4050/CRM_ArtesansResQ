-- Мультитенантность, шаг 5: делаем organization_id обязательным и уникальным
-- в правильном разрезе, добавляем индексы под паттерны запросов приложения.

-- Защитная проверка: бэкфилл из предыдущей миграции обязан быть завершён.
do $$
declare
  remaining integer;
begin
  select
    (select count(*) from public.users where organization_id is null) +
    (select count(*) from public.vehicles where organization_id is null) +
    (select count(*) from public.bags where organization_id is null) +
    (select count(*) from public.consumables where organization_id is null) +
    (select count(*) from public.calls where organization_id is null) +
    (select count(*) from public.writeoffs where organization_id is null) +
    (select count(*) from public.stock_movements where organization_id is null)
  into remaining;

  if remaining > 0 then
    raise exception 'Бэкфилл organization_id не завершён: % строк(и) без организации. Примените 202607170002 перед этой миграцией.', remaining;
  end if;
end $$;

-- Триггер log_stock_movement должен проставлять organization_id ДО того, как эта
-- миграция сделает stock_movements.organization_id обязательным — иначе следующее
-- же изменение qty_in_stock упадёт с нарушением not-null.
create or replace function public.log_stock_movement()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
declare
  delta integer;
begin
  if tg_op = 'INSERT' then
    if new.qty_in_stock = 0 then
      return new;
    end if;

    insert into public.stock_movements (
      consumable_id, movement_type, quantity_delta,
      quantity_before, quantity_after, user_id, organization_id
    ) values (
      new.id, 'opening_balance', new.qty_in_stock,
      0, new.qty_in_stock, auth.uid(), new.organization_id
    );
    return new;
  end if;

  delta := new.qty_in_stock - old.qty_in_stock;
  if delta = 0 then
    return new;
  end if;

  insert into public.stock_movements (
    consumable_id, movement_type, quantity_delta,
    quantity_before, quantity_after, user_id, organization_id
  ) values (
    new.id,
    case when delta > 0 then 'increase' else 'decrease' end,
    delta, old.qty_in_stock, new.qty_in_stock, auth.uid(), new.organization_id
  );

  return new;
end;
$$;

-- NOT NULL на небольших справочных таблицах — простой alter, без long-lock риска.
alter table public.users alter column organization_id set not null;
alter table public.vehicles alter column organization_id set not null;
alter table public.bags alter column organization_id set not null;
alter table public.consumables alter column organization_id set not null;

-- NOT NULL на таблицах, которые растут без ограничений (calls/writeoffs/stock_movements):
-- сначала невалидированный check (быстрая блокировка), потом validate (без ACCESS EXCLUSIVE),
-- потом set not null (Postgres пропускает повторное сканирование благодаря валидированному check).
alter table public.calls add constraint calls_organization_id_not_null check (organization_id is not null) not valid;
alter table public.calls validate constraint calls_organization_id_not_null;
alter table public.calls alter column organization_id set not null;
alter table public.calls drop constraint calls_organization_id_not_null;

alter table public.writeoffs add constraint writeoffs_organization_id_not_null check (organization_id is not null) not valid;
alter table public.writeoffs validate constraint writeoffs_organization_id_not_null;
alter table public.writeoffs alter column organization_id set not null;
alter table public.writeoffs drop constraint writeoffs_organization_id_not_null;

alter table public.stock_movements add constraint stock_movements_organization_id_not_null check (organization_id is not null) not valid;
alter table public.stock_movements validate constraint stock_movements_organization_id_not_null;
alter table public.stock_movements alter column organization_id set not null;
alter table public.stock_movements drop constraint stock_movements_organization_id_not_null;

-- Составные уникальные ограничения вместо одиночных (число/код уникальны в рамках организации).
-- Ищем и дропаем текущее одноколоночное unique-ограничение динамически — не полагаемся
-- на предполагаемое автосгенерированное имя.
do $$
declare
  c record;
begin
  for c in
    select conname
    from pg_constraint
    where conrelid = 'public.vehicles'::regclass
      and contype = 'u'
      and (select array_agg(attname::text order by attname) from pg_attribute where attrelid = conrelid and attnum = any(conkey)) = array['number']
  loop
    execute format('alter table public.vehicles drop constraint %I', c.conname);
  end loop;
end $$;
alter table public.vehicles add constraint vehicles_organization_id_number_key unique (organization_id, number);

do $$
declare
  c record;
begin
  for c in
    select conname
    from pg_constraint
    where conrelid = 'public.bags'::regclass
      and contype = 'u'
      and (select array_agg(attname::text order by attname) from pg_attribute where attrelid = conrelid and attnum = any(conkey)) = array['number']
  loop
    execute format('alter table public.bags drop constraint %I', c.conname);
  end loop;
end $$;
alter table public.bags add constraint bags_organization_id_number_key unique (organization_id, number);

do $$
declare
  c record;
begin
  for c in
    select conname
    from pg_constraint
    where conrelid = 'public.consumables'::regclass
      and contype = 'u'
      and (select array_agg(attname::text order by attname) from pg_attribute where attrelid = conrelid and attnum = any(conkey)) = array['code']
  loop
    execute format('alter table public.consumables drop constraint %I', c.conname);
  end loop;
end $$;
alter table public.consumables add constraint consumables_organization_id_code_key unique (organization_id, code);

-- Индексы под паттерны запросов из lib/data/*.ts.
create index if not exists users_organization_id_idx on public.users(organization_id);
create index if not exists calls_organization_id_date_idx on public.calls(organization_id, date desc);
create index if not exists writeoffs_organization_id_created_at_idx on public.writeoffs(organization_id, created_at desc);
create index if not exists stock_movements_organization_id_created_at_idx on public.stock_movements(organization_id, created_at desc);
