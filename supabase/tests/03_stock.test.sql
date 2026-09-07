-- Fixtures (from 00_setup.sql):
--   admin_a = bbbbbbbb-...-0002 (org A)
--   medic_a = bbbbbbbb-...-0003 (org A)
begin;
select plan(23);

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

-- delete_consumable: full delete despite write-off/movement history, but
-- only once the team stops holding any of it.
insert into public.consumables (id, code, name, unit, qty_in_stock, qty_minimum, organization_id)
values ('cccccccc-0000-0000-0000-000000000005', 'TST-005', 'Test Gauze To Delete', 'pcs', 20, 2, 'aaaaaaaa-0000-0000-0000-000000000001');

select lives_ok(
  $$ select public.transfer_to_team_stock('cccccccc-0000-0000-0000-000000000005'::uuid, 5) $$,
  'admin seeds team stock for the delete test'
);
select lives_ok(
  $$ select public.create_call_with_writeoffs(
       now(), 'pgtap-marker-delete-consumable', 'dddddddd-0000-0000-0000-000000000001'::uuid, 'eeeeeeee-0000-0000-0000-000000000001'::uuid,
       jsonb_build_array(jsonb_build_object('consumable_id', 'cccccccc-0000-0000-0000-000000000005', 'quantity', 2))
     ) $$,
  'a write-off is recorded against the item that will be deleted'
);

select throws_like(
  $$ select public.delete_consumable('cccccccc-0000-0000-0000-000000000005'::uuid) $$,
  'This item still has%unit(s) in team stock%',
  'delete is rejected while the team still holds stock of this item'
);

select lives_ok(
  $$ select public.discard_from_team_stock('cccccccc-0000-0000-0000-000000000005'::uuid, 3) $$,
  'admin discards the remaining team stock down to zero'
);
select lives_ok(
  $$ select public.delete_consumable('cccccccc-0000-0000-0000-000000000005'::uuid) $$,
  'delete succeeds once team stock is back to zero, despite write-off/movement history'
);

select is(
  (select consumable_id from public.writeoffs where call_id = (select id from public.calls where description = 'pgtap-marker-delete-consumable')),
  null::uuid,
  'the historical write-off survives the delete with its consumable_id nulled out'
);
select is(
  (select count(*)::int from public.stock_movements
   where quantity_delta = 20 and movement_type = 'opening_balance'
     and organization_id = 'aaaaaaaa-0000-0000-0000-000000000001'::uuid
     and consumable_id is null),
  1,
  'the opening-balance stock movement survives the delete with a null consumable_id'
);

-- confirm_inventory_import (202609070003): applies an Excel import's new
-- items and restocks of existing ones as a single transaction.
select tests.authenticate_as('bbbbbbbb-0000-0000-0000-000000000003');
select throws_like(
  $$ select public.confirm_inventory_import('[]'::jsonb, '[]'::jsonb) $$,
  'Only an administrator can import inventory',
  'medic cannot confirm an inventory import'
);

select tests.authenticate_as('bbbbbbbb-0000-0000-0000-000000000002');
insert into public.consumables (id, code, name, unit, qty_in_stock, qty_minimum, organization_id)
values ('cccccccc-0000-0000-0000-000000000006', 'TST-006', 'Import Restock Target', 'pcs', 10, 0, 'aaaaaaaa-0000-0000-0000-000000000001');

select lives_ok(
  $$ select public.confirm_inventory_import(
       jsonb_build_array(
         jsonb_build_object('code', 'TST-010', 'name', 'Imported Item A', 'category', 'other', 'unit', 'pcs', 'quantity', 3, 'qty_minimum', 1, 'description', null),
         jsonb_build_object('code', 'TST-011', 'name', 'Imported Item B', 'category', 'other', 'unit', 'pcs', 'quantity', 7, 'qty_minimum', 0, 'description', null)
       ),
       jsonb_build_array(
         jsonb_build_object('consumable_id', 'cccccccc-0000-0000-0000-000000000006', 'quantity', 5)
       )
     ) $$,
  'admin imports two new items and restocks one existing item in a single call'
);
select is(
  (select count(*)::int from public.consumables where code in ('TST-010', 'TST-011') and organization_id = 'aaaaaaaa-0000-0000-0000-000000000001'::uuid),
  2,
  'both new items were created'
);
select is(
  (select qty_in_stock from public.consumables where code = 'TST-010'),
  3,
  'the first new item has its imported opening stock'
);
select is(
  (select qty_in_stock from public.consumables where id = 'cccccccc-0000-0000-0000-000000000006'::uuid),
  15,
  'the restocked item increased by the imported quantity (10 + 5)'
);

-- Atomicity: a batch where one row is bad rolls back the whole batch,
-- including otherwise-valid rows already processed earlier in the same call.
select throws_like(
  $$ select public.confirm_inventory_import(
       jsonb_build_array(
         jsonb_build_object('code', 'TST-012', 'name', 'Imported Item C', 'category', 'other', 'unit', 'pcs', 'quantity', 1, 'qty_minimum', 0, 'description', null),
         jsonb_build_object('code', 'TST-010', 'name', 'Duplicate Code Item', 'category', 'other', 'unit', 'pcs', 'quantity', 1, 'qty_minimum', 0, 'description', null)
       ),
       '[]'::jsonb
     ) $$,
  '%',
  'a batch containing a duplicate code is rejected'
);
select is(
  (select count(*)::int from public.consumables where code = 'TST-012'),
  0,
  'the otherwise-valid first row in that failed batch was rolled back too - not partially applied'
);

select throws_like(
  $$ select public.confirm_inventory_import(
       jsonb_build_array(
         jsonb_build_object('code', 'TST-013', 'name', 'Imported Item D', 'category', 'other', 'unit', 'pcs', 'quantity', 1, 'qty_minimum', 0, 'description', null)
       ),
       jsonb_build_array(
         jsonb_build_object('consumable_id', gen_random_uuid(), 'quantity', 1)
       )
     ) $$,
  '%',
  'a batch with a restock of a non-existent item is rejected'
);
select is(
  (select count(*)::int from public.consumables where code = 'TST-013'),
  0,
  'the new item from that failed batch was rolled back too, since the restock in the same batch failed'
);

select * from finish();
rollback;
