-- Fixtures (from 01_fixtures.sql):
--   master_admin_a = bbbbbbbb-...-0001 (org A)
--   admin_a        = bbbbbbbb-...-0002 (org A)
--   medic_a        = bbbbbbbb-...-0003 (org A)
begin;
select plan(4);

-- Restricting a user (is_active = false) makes current_org_id() return
-- null for them - the single choke point almost every RLS policy and
-- insert default runs through, so this one flag cuts off their access to
-- every table without needing a matching change in each policy.
update public.users set is_active = false where id = 'bbbbbbbb-0000-0000-0000-000000000003';

select tests.authenticate_as('bbbbbbbb-0000-0000-0000-000000000003');
select is(
  public.current_org_id(),
  null::uuid,
  'a restricted user resolves to no organization'
);
select is(
  (select count(*) from public.vehicles)::int,
  0,
  'a restricted user cannot see their org''s data through RLS'
);

-- Restoring access (is_active = true) reverses it immediately.
update public.users set is_active = true where id = 'bbbbbbbb-0000-0000-0000-000000000003';
select is(
  public.current_org_id(),
  'aaaaaaaa-0000-0000-0000-000000000001'::uuid,
  'restoring access resolves the organization again'
);
select is(
  (select count(*) from public.vehicles)::int,
  1,
  'a restored user can see their org''s data again'
);

select * from finish();
rollback;
