-- Fixtures (from 01_fixtures.sql):
--   admin_a = bbbbbbbb-...-0002 (org A)
--   admin_b = bbbbbbbb-...-0004 (org B)
--
-- A dedicated test that org-scoping is enforced on its own, rather than
-- only incidentally exercised inside the role/write-off test files.
begin;
select plan(4);

select tests.authenticate_as('bbbbbbbb-0000-0000-0000-000000000004');

insert into public.consumables (id, code, name, unit, qty_in_stock, qty_minimum, organization_id)
values ('cccccccc-0000-0000-0000-000000000004', 'TST-004', 'Org B Item', 'pcs', 10, 2, 'aaaaaaaa-0000-0000-0000-000000000002');

select tests.authenticate_as('bbbbbbbb-0000-0000-0000-000000000002');

select throws_like(
  $$ select public.restock_consumable('cccccccc-0000-0000-0000-000000000004'::uuid, 1) $$,
  'Item not found or removed from inventory',
  'org A admin cannot restock an org B consumable'
);
select throws_like(
  $$ select public.archive_consumable('cccccccc-0000-0000-0000-000000000004'::uuid) $$,
  'Item not found or already removed',
  'org A admin cannot archive an org B consumable'
);
select throws_like(
  $$ select public.delete_consumable('cccccccc-0000-0000-0000-000000000004'::uuid) $$,
  'Item not found',
  'org A admin cannot delete an org B consumable'
);
select throws_like(
  $$ select public.transfer_to_team_stock('cccccccc-0000-0000-0000-000000000004'::uuid, 1) $$,
  'Item not found or removed from inventory',
  'org A admin cannot issue an org B consumable to their team'
);

select * from finish();
rollback;
