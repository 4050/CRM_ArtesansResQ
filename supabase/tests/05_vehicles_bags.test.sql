-- Fixtures (from 01_fixtures.sql):
--   admin_a    = bbbbbbbb-...-0002 (org A)
--   medic_a    = bbbbbbbb-...-0003 (org A)
--   vehicle_a1 = dddddddd-...-0001 (org A, shared - never archived/deleted here)
--   bag_a1     = eeeeeeee-...-0001 (org A, belongs to vehicle_a1, shared)
--
-- Uses a throwaway vehicle/bag pair (suffix -0099) for the archive/delete
-- mutations so the shared fixtures above stay untouched for other files.
begin;
select plan(8);

select tests.authenticate_as('bbbbbbbb-0000-0000-0000-000000000003');
select throws_like(
  $$ select public.archive_vehicle('dddddddd-0000-0000-0000-000000000001'::uuid) $$,
  'Only an administrator can delete vehicles',
  'medic cannot archive a vehicle'
);

select tests.authenticate_as('bbbbbbbb-0000-0000-0000-000000000002');

insert into public.vehicles (id, number, organization_id) values
  ('dddddddd-0000-0000-0000-000000000099', 'V-99', 'aaaaaaaa-0000-0000-0000-000000000001');
insert into public.bags (id, number, vehicle_id, organization_id) values
  ('eeeeeeee-0000-0000-0000-000000000099', 'B-99', 'dddddddd-0000-0000-0000-000000000099', 'aaaaaaaa-0000-0000-0000-000000000001');

select lives_ok(
  $$ select public.archive_vehicle('dddddddd-0000-0000-0000-000000000099'::uuid) $$,
  'admin can archive an active vehicle'
);
select throws_like(
  $$ select public.archive_vehicle('dddddddd-0000-0000-0000-000000000099'::uuid) $$,
  'Vehicle not found or already removed',
  'archiving an already-archived vehicle fails'
);
select throws_like(
  $$ select public.delete_vehicle('dddddddd-0000-0000-0000-000000000099'::uuid) $$,
  'Cannot delete vehicle: bags or calls still reference it%',
  'deleting a vehicle with a referencing bag is blocked'
);
select lives_ok(
  $$ select public.delete_bag('eeeeeeee-0000-0000-0000-000000000099'::uuid) $$,
  'admin can delete a bag with no references'
);
select lives_ok(
  $$ select public.delete_vehicle('dddddddd-0000-0000-0000-000000000099'::uuid) $$,
  'admin can delete a vehicle once nothing references it'
);
select throws_like(
  $$ select public.delete_vehicle('dddddddd-0000-0000-0000-000000000099'::uuid) $$,
  'Vehicle not found',
  'deleting an already-deleted vehicle fails'
);

select tests.authenticate_as('bbbbbbbb-0000-0000-0000-000000000003');
select throws_like(
  $$ select public.delete_bag('eeeeeeee-0000-0000-0000-000000000001'::uuid) $$,
  'Only an administrator can delete bags',
  'medic cannot delete a bag'
);

select * from finish();
rollback;
