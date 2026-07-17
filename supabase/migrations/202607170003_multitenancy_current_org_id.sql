-- Мультитенантность, шаг 4: хелпер current_org_id(), зеркалит is_admin().
create or replace function public.current_org_id()
returns uuid
language sql
stable
security definer set search_path = ''
as $$
  select organization_id from public.users where id = auth.uid();
$$;

-- Прямые insert'ы (например, создание позиции склада из приложения, не через RPC)
-- автоматически получают организацию текущего пользователя, если явно не указана.
alter table public.consumables alter column organization_id set default public.current_org_id();
