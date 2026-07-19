-- Run AFTER schema.sql. Fixtures shared by every *.test.sql file below.
-- Committed here (this file runs outside a transaction block) so they
-- persist across test files; each test file wraps its own mutations in
-- begin/rollback and never touches these rows directly, only
-- reads/references them by id.
insert into public.organizations (id, name) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'Test Org A'),
  ('aaaaaaaa-0000-0000-0000-000000000002', 'Test Org B');

insert into auth.users (id, email, raw_user_meta_data) values
  ('bbbbbbbb-0000-0000-0000-000000000001', 'master-a@test.local', '{"organization_id":"aaaaaaaa-0000-0000-0000-000000000001","name":"Master A"}'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'admin-a@test.local', '{"organization_id":"aaaaaaaa-0000-0000-0000-000000000001","name":"Admin A"}'),
  ('bbbbbbbb-0000-0000-0000-000000000003', 'medic-a@test.local', '{"organization_id":"aaaaaaaa-0000-0000-0000-000000000001","name":"Medic A"}'),
  ('bbbbbbbb-0000-0000-0000-000000000004', 'admin-b@test.local', '{"organization_id":"aaaaaaaa-0000-0000-0000-000000000002","name":"Admin B"}');

-- handle_new_user() just inserted all four into public.users with role
-- 'medic' by default (see schema.sql) - promote the ones that need it.
update public.users set role = 'master_admin' where id = 'bbbbbbbb-0000-0000-0000-000000000001';
update public.users set role = 'admin' where id in (
  'bbbbbbbb-0000-0000-0000-000000000002',
  'bbbbbbbb-0000-0000-0000-000000000004'
);

-- A vehicle + matching bag in org A, used by the calls/write-offs and
-- vehicle/bag archiving test suites.
insert into public.vehicles (id, number, name, organization_id) values
  ('dddddddd-0000-0000-0000-000000000001', 'V-01', 'Test Vehicle', 'aaaaaaaa-0000-0000-0000-000000000001');
insert into public.bags (id, number, vehicle_id, organization_id) values
  ('eeeeeeee-0000-0000-0000-000000000001', 'B-01', 'dddddddd-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001');
