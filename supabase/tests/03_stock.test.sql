-- Fixtures (from 00_setup.sql):
--   admin_a = bbbbbbbb-...-0002 (org A)
--   medic_a = bbbbbbbb-...-0003 (org A)
begin;
select plan(7);

select tests.authenticate_as('bbbbbbbb-0000-0000-0000-000000000002');

insert into public.consumables (id, code, name, unit, qty_in_stock, qty_minimum, organization_id)
values ('cccccccc-0000-0000-0000-000000000001', 'TST-001', 'Test Bandage', 'pcs', 10, 2, 'aaaaaaaa-0000-0000-0000-000000000001');

select lives_ok(
  $$ select public.restock_consumable('cccccccc-0000-0000-0000-000000000001'::uuid, 5) $$,
  'admin can restock an active item'
);
select is(
  (select qty_in_stock from public.consumables where id = 'cccccccc-0000-0000-0000-000000000001'::uuid),
  15,
  'qty_in_stock increased by the restocked amount'
);

select throws_like(
  $$ select public.restock_consumable('cccccccc-0000-0000-0000-000000000001'::uuid, 0) $$,
  'Restock quantity must be greater than zero',
  'restock rejects a zero/negative quantity'
);

select tests.authenticate_as('bbbbbbbb-0000-0000-0000-000000000003');
select throws_like(
  $$ select public.restock_consumable('cccccccc-0000-0000-0000-000000000001'::uuid, 1) $$,
  'Only an administrator can restock inventory',
  'medic cannot restock'
);

select tests.authenticate_as('bbbbbbbb-0000-0000-0000-000000000002');

select lives_ok(
  $$ select public.archive_consumable('cccccccc-0000-0000-0000-000000000001'::uuid) $$,
  'admin can archive an active item'
);
select throws_like(
  $$ select public.restock_consumable('cccccccc-0000-0000-0000-000000000001'::uuid, 1) $$,
  'Item not found or removed from inventory',
  'restock rejects an archived item'
);
select throws_like(
  $$ select public.archive_consumable('cccccccc-0000-0000-0000-000000000001'::uuid) $$,
  'Item not found or already removed',
  'archiving an already-archived item fails'
);

select * from finish();
rollback;
