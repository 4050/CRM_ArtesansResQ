-- Мультитенантность, шаг 8: новые пользователи обязаны получить organization_id
-- при создании — через raw_user_meta_data (тот же способ, которым сейчас передаётся "name").
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
declare
  v_org_id uuid;
begin
  v_org_id := nullif(new.raw_user_meta_data->>'organization_id', '')::uuid;

  if v_org_id is null then
    raise exception 'organization_id обязателен в raw_user_meta_data при создании пользователя';
  end if;

  insert into public.users (id, name, role, organization_id)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    'medic',
    v_org_id
  );
  return new;
end;
$$;
