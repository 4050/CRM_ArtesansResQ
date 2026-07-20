-- Fixtures (from 00_setup.sql):
--   master_admin_a = bbbbbbbb-...-0001 (org A)
--   admin_a        = bbbbbbbb-...-0002 (org A)
--   medic_a        = bbbbbbbb-...-0003 (org A)
--   admin_b        = bbbbbbbb-...-0004 (org B)
begin;
select plan(11);

select tests.authenticate_as('bbbbbbbb-0000-0000-0000-000000000001');
select ok(public.is_admin(), 'master_admin counts as admin');
select ok(public.is_master_admin(), 'master_admin is master_admin');

select tests.authenticate_as('bbbbbbbb-0000-0000-0000-000000000002');
select ok(public.is_admin(), 'admin counts as admin');
select ok(not public.is_master_admin(), 'admin is not master_admin');

select tests.authenticate_as('bbbbbbbb-0000-0000-0000-000000000003');
select ok(not public.is_admin(), 'medic does not count as admin');

-- only master_admin may call set_user_role
select throws_like(
  $$ select public.set_user_role('bbbbbbbb-0000-0000-0000-000000000003'::uuid, 'admin') $$,
  'Only a master admin%',
  'a plain admin cannot call set_user_role'
);

select tests.authenticate_as('bbbbbbbb-0000-0000-0000-000000000001');

-- cannot grant master_admin through the RPC
select throws_like(
  $$ select public.set_user_role('bbbbbbbb-0000-0000-0000-000000000003'::uuid, 'master_admin') $$,
  'Role must be admin or medic',
  'cannot grant master_admin through set_user_role'
);

-- cannot change own role
select throws_like(
  $$ select public.set_user_role('bbbbbbbb-0000-0000-0000-000000000001'::uuid, 'admin') $$,
  'You cannot change your own role',
  'master_admin cannot change own role'
);

-- cannot reach into another organization
select throws_like(
  $$ select public.set_user_role('bbbbbbbb-0000-0000-0000-000000000004'::uuid, 'medic') $$,
  'User not found in your organization',
  'master_admin cannot change a role in a different organization'
);

-- happy path: promote medic_a to admin within the same org
select lives_ok(
  $$ select public.set_user_role('bbbbbbbb-0000-0000-0000-000000000003'::uuid, 'admin') $$,
  'master_admin can promote a medic to admin in their own org'
);
select is(
  (select role from public.users where id = 'bbbbbbbb-0000-0000-0000-000000000003'::uuid),
  'admin',
  'role was actually updated'
);

select * from finish();
rollback;
