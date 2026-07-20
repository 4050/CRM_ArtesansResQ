-- Мультитенантность, шаг 1: таблица организаций.
create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

alter table public.organizations enable row level security;

-- Единственная организация, к которой принадлежат все текущие данные.
-- Фиксированный id (не gen_random_uuid()), чтобы следующие миграции могли
-- детерминированно на неё ссылаться при бэкфилле.
insert into public.organizations (id, name)
values ('11111111-1111-1111-1111-111111111111', 'МедСклад — основная организация')
on conflict (id) do nothing;
