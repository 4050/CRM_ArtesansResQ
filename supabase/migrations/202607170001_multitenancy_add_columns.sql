-- Мультитенантность, шаг 2: добавляем nullable organization_id везде.
-- Чисто аддитивно — не меняет поведение работающего приложения.
alter table public.users add column if not exists organization_id uuid references public.organizations(id);
alter table public.vehicles add column if not exists organization_id uuid references public.organizations(id);
alter table public.bags add column if not exists organization_id uuid references public.organizations(id);
alter table public.consumables add column if not exists organization_id uuid references public.organizations(id);
alter table public.calls add column if not exists organization_id uuid references public.organizations(id);
alter table public.writeoffs add column if not exists organization_id uuid references public.organizations(id);
alter table public.stock_movements add column if not exists organization_id uuid references public.organizations(id);
