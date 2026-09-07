-- Fixtures (from 01_fixtures.sql):
--   admin_a    = bbbbbbbb-...-0002 (org A)
--   medic_a    = bbbbbbbb-...-0003 (org A)
--   admin_b    = bbbbbbbb-...-0004 (org B - used for cross-org/non-owner checks)
--   vehicle_a1 = dddddddd-...-0001 (org A)
--   bag_a1     = eeeeeeee-...-0001 (org A, independent of any vehicle)
--
-- The test call is found by its fixed, never-renamed description
-- ('pgtap-marker-call-1') rather than a captured id, so no psql variable
-- capture (\gset) is needed - keeps this file plain, portable SQL.
begin;
select plan(36);

-- An org B vehicle, used only to prove update_call_with_writeoffs rejects a
-- cross-org p_vehicle_id (see create_call_with_writeoffs's equivalent
-- check, which update_call_with_writeoffs was missing).
insert into public.vehicles (id, number, organization_id) values
  ('dddddddd-0000-0000-0000-000000000099', 'V-99-org-b', 'aaaaaaaa-0000-0000-0000-000000000002');

select tests.authenticate_as('bbbbbbbb-0000-0000-0000-000000000002');

insert into public.consumables (id, code, name, unit, qty_in_stock, qty_minimum, organization_id)
values ('cccccccc-0000-0000-0000-000000000003', 'TST-003', 'Test Dressing', 'pcs', 50, 2, 'aaaaaaaa-0000-0000-0000-000000000001');

select lives_ok(
  $$ select public.transfer_to_team_stock('cccccccc-0000-0000-0000-000000000003'::uuid, 20) $$,
  'admin seeds team stock for the write-off tests'
);

select tests.authenticate_as('bbbbbbbb-0000-0000-0000-000000000003');

select throws_like(
  $$ select public.create_call_with_writeoffs(now(), 'bad bag', 'dddddddd-0000-0000-0000-000000000001'::uuid, 'eeeeeeee-0000-0000-0000-000000000099'::uuid, '[]'::jsonb) $$,
  'Bag not found',
  'creating a call with a non-existent bag is rejected'
);

-- bags and vehicles are decoupled: a bag has no vehicle_id at all now, so
-- pairing it with any vehicle - not just one it was ever "assigned" to -
-- must succeed.
insert into public.vehicles (id, number, organization_id) values
  ('dddddddd-0000-0000-0000-000000000098', 'V-98', 'aaaaaaaa-0000-0000-0000-000000000001');
select lives_ok(
  $$ select public.create_call_with_writeoffs(now(), 'pgtap-marker-decoupled', 'dddddddd-0000-0000-0000-000000000098'::uuid, 'eeeeeeee-0000-0000-0000-000000000001'::uuid, '[]'::jsonb) $$,
  'a bag can be paired with any vehicle now that they are decoupled'
);

select throws_like(
  $$ select public.create_call_with_writeoffs(
       now(), 'bad qty', 'dddddddd-0000-0000-0000-000000000001'::uuid, 'eeeeeeee-0000-0000-0000-000000000001'::uuid,
       jsonb_build_array(jsonb_build_object('consumable_id', 'cccccccc-0000-0000-0000-000000000003', 'quantity', 0))
     ) $$,
  'Write-off quantity must be greater than zero',
  'a non-positive write-off quantity is rejected'
);

select lives_ok(
  $$ select public.create_call_with_writeoffs(
       now(), 'pgtap-marker-call-1', 'dddddddd-0000-0000-0000-000000000001'::uuid, 'eeeeeeee-0000-0000-0000-000000000001'::uuid,
       jsonb_build_array(jsonb_build_object('consumable_id', 'cccccccc-0000-0000-0000-000000000003', 'quantity', 5))
     ) $$,
  'medic can create a call with a write-off'
);
select is(
  (select qty_in_stock from public.team_stock where consumable_id = 'cccccccc-0000-0000-0000-000000000003'::uuid),
  15,
  'team stock decreased by the written-off quantity'
);

-- a different organization's admin can neither see nor touch this call
select tests.authenticate_as('bbbbbbbb-0000-0000-0000-000000000004');
select throws_like(
  $$ select public.update_call_with_writeoffs(
       (select id from public.calls where description = 'pgtap-marker-call-1'),
       now(), 'pgtap-marker-call-1', 'dddddddd-0000-0000-0000-000000000001'::uuid, 'eeeeeeee-0000-0000-0000-000000000001'::uuid, '[]'::jsonb
     ) $$,
  'Call not found or insufficient permissions',
  'a different organization''s admin cannot update this call'
);
select throws_like(
  $$ select public.delete_call_with_writeoffs((select id from public.calls where description = 'pgtap-marker-call-1')) $$,
  'Call not found or insufficient permissions',
  'a different organization''s admin cannot delete this call'
);

-- the owner can update their own call
select tests.authenticate_as('bbbbbbbb-0000-0000-0000-000000000003');
select lives_ok(
  $$ select public.update_call_with_writeoffs(
       (select id from public.calls where description = 'pgtap-marker-call-1'),
       now(), 'pgtap-marker-call-1', 'dddddddd-0000-0000-0000-000000000001'::uuid, 'eeeeeeee-0000-0000-0000-000000000001'::uuid,
       jsonb_build_array(jsonb_build_object('consumable_id', 'cccccccc-0000-0000-0000-000000000003', 'quantity', 8))
     ) $$,
  'the call owner can update their own call'
);
select is(
  (select qty_in_stock from public.team_stock where consumable_id = 'cccccccc-0000-0000-0000-000000000003'::uuid),
  12,
  'team stock reflects the owner''s updated write-off quantity (20 - 8)'
);

-- a vehicle from another organization is rejected, same as a foreign bag
-- already was - update_call_with_writeoffs was missing this check
select throws_like(
  $$ select public.update_call_with_writeoffs(
       (select id from public.calls where description = 'pgtap-marker-call-1'),
       now(), 'pgtap-marker-call-1', 'dddddddd-0000-0000-0000-000000000099'::uuid, 'eeeeeeee-0000-0000-0000-000000000001'::uuid, '[]'::jsonb
     ) $$,
  'Vehicle not found',
  'updating a call with another organization''s vehicle is rejected'
);

-- an admin in the same org can update someone else's call too
select tests.authenticate_as('bbbbbbbb-0000-0000-0000-000000000002');
select lives_ok(
  $$ select public.update_call_with_writeoffs(
       (select id from public.calls where description = 'pgtap-marker-call-1'),
       now(), 'pgtap-marker-call-1', 'dddddddd-0000-0000-0000-000000000001'::uuid, 'eeeeeeee-0000-0000-0000-000000000001'::uuid,
       jsonb_build_array(jsonb_build_object('consumable_id', 'cccccccc-0000-0000-0000-000000000003', 'quantity', 3))
     ) $$,
  'an admin can update another user''s call'
);
select is(
  (select qty_in_stock from public.team_stock where consumable_id = 'cccccccc-0000-0000-0000-000000000003'::uuid),
  17,
  'team stock reflects the admin''s updated write-off quantity (20 - 3)'
);

select lives_ok(
  $$ select public.delete_call_with_writeoffs((select id from public.calls where description = 'pgtap-marker-call-1')) $$,
  'admin can delete the call'
);
select is(
  (select qty_in_stock from public.team_stock where consumable_id = 'cccccccc-0000-0000-0000-000000000003'::uuid),
  20,
  'team stock is fully restored after the call is deleted'
);

-- Regression for 202609050001_guard_null_consumable_return.sql: editing or
-- deleting a call whose write-off references a since-deleted consumable
-- (consumable_id nulled by "on delete set null" - see 202607230001) used to
-- crash while trying to return that quantity to team_stock, because the
-- return loop grouped by consumable_id including NULL and fed it straight
-- into adjust_team_stock(), which violates team_stock's not-null columns.
select tests.authenticate_as('bbbbbbbb-0000-0000-0000-000000000002');

insert into public.consumables (id, code, name, unit, qty_in_stock, qty_minimum, organization_id)
values
  ('cccccccc-0000-0000-0000-000000000004', 'TST-004', 'Doomed Dressing A', 'pcs', 10, 0, 'aaaaaaaa-0000-0000-0000-000000000001'),
  ('cccccccc-0000-0000-0000-000000000005', 'TST-005', 'Doomed Dressing B', 'pcs', 10, 0, 'aaaaaaaa-0000-0000-0000-000000000001');

select lives_ok(
  $$ select public.transfer_to_team_stock('cccccccc-0000-0000-0000-000000000004'::uuid, 5) $$,
  'admin seeds team stock for consumable A (about to be deleted)'
);
select lives_ok(
  $$ select public.transfer_to_team_stock('cccccccc-0000-0000-0000-000000000005'::uuid, 5) $$,
  'admin seeds team stock for consumable B (about to be deleted)'
);

select tests.authenticate_as('bbbbbbbb-0000-0000-0000-000000000003');
select lives_ok(
  $$ select public.create_call_with_writeoffs(
       now(), 'pgtap-marker-deleted-a', 'dddddddd-0000-0000-0000-000000000001'::uuid, 'eeeeeeee-0000-0000-0000-000000000001'::uuid,
       jsonb_build_array(jsonb_build_object('consumable_id', 'cccccccc-0000-0000-0000-000000000004', 'quantity', 5))
     ) $$,
  'medic writes off all of consumable A, zeroing its team stock'
);
select lives_ok(
  $$ select public.create_call_with_writeoffs(
       now(), 'pgtap-marker-deleted-b', 'dddddddd-0000-0000-0000-000000000001'::uuid, 'eeeeeeee-0000-0000-0000-000000000001'::uuid,
       jsonb_build_array(jsonb_build_object('consumable_id', 'cccccccc-0000-0000-0000-000000000005', 'quantity', 5))
     ) $$,
  'medic writes off all of consumable B, zeroing its team stock'
);

select tests.authenticate_as('bbbbbbbb-0000-0000-0000-000000000002');
select lives_ok(
  $$ select public.delete_consumable('cccccccc-0000-0000-0000-000000000004'::uuid) $$,
  'admin deletes consumable A now that its team stock is back to zero'
);
select lives_ok(
  $$ select public.delete_consumable('cccccccc-0000-0000-0000-000000000005'::uuid) $$,
  'admin deletes consumable B now that its team stock is back to zero'
);

select lives_ok(
  $$ select public.update_call_with_writeoffs(
       (select id from public.calls where description = 'pgtap-marker-deleted-a'),
       now(), 'pgtap-marker-deleted-a-edited', 'dddddddd-0000-0000-0000-000000000001'::uuid, 'eeeeeeee-0000-0000-0000-000000000001'::uuid, '[]'::jsonb
     ) $$,
  'editing a call whose write-off references a deleted consumable no longer crashes on returning stock'
);
select lives_ok(
  $$ select public.delete_call_with_writeoffs((select id from public.calls where description = 'pgtap-marker-deleted-b')) $$,
  'deleting a call whose write-off references a deleted consumable no longer crashes on returning stock'
);

-- Regression for 202609070001_diff_based_writeoff_edit.sql: editing a call
-- must not reset an unrelated line's attribution or generate a phantom
-- stock_movements pair for a quantity that didn't actually change, and a
-- genuine quantity change must move stock by only the delta - not "return
-- the old amount, then reissue the new one" (2 movements instead of 1).
select tests.authenticate_as('bbbbbbbb-0000-0000-0000-000000000002');

insert into public.consumables (id, code, name, unit, qty_in_stock, qty_minimum, organization_id)
values ('cccccccc-0000-0000-0000-000000000006', 'TST-006', 'Diff Test Dressing', 'pcs', 50, 0, 'aaaaaaaa-0000-0000-0000-000000000001');

select lives_ok(
  $$ select public.transfer_to_team_stock('cccccccc-0000-0000-0000-000000000006'::uuid, 20) $$,
  'admin seeds team stock for the diff-based-edit tests'
);

select tests.authenticate_as('bbbbbbbb-0000-0000-0000-000000000003');
select lives_ok(
  $$ select public.create_call_with_writeoffs(
       now(), 'pgtap-marker-diff-1', 'dddddddd-0000-0000-0000-000000000001'::uuid, 'eeeeeeee-0000-0000-0000-000000000001'::uuid,
       jsonb_build_array(jsonb_build_object('consumable_id', 'cccccccc-0000-0000-0000-000000000006', 'quantity', 4))
     ) $$,
  'medic creates a call writing off 4 of the diff-test item'
);
select is(
  (select count(*)::int from public.stock_movements where consumable_id = 'cccccccc-0000-0000-0000-000000000006'::uuid and warehouse = 'team'),
  2,
  'baseline: 2 team-stock movements so far (seed increase + write-off decrease)'
);

-- admin edits only the call's own description - quantity/consumable untouched
select tests.authenticate_as('bbbbbbbb-0000-0000-0000-000000000002');
select lives_ok(
  $$ select public.update_call_with_writeoffs(
       (select id from public.calls where description = 'pgtap-marker-diff-1'),
       now(), 'pgtap-marker-diff-1-renamed', 'dddddddd-0000-0000-0000-000000000001'::uuid, 'eeeeeeee-0000-0000-0000-000000000001'::uuid,
       jsonb_build_array(jsonb_build_object('consumable_id', 'cccccccc-0000-0000-0000-000000000006', 'quantity', 4))
     ) $$,
  'admin renames the call without changing its write-offs'
);
select is(
  (select user_id from public.writeoffs where call_id = (select id from public.calls where description = 'pgtap-marker-diff-1-renamed')),
  'bbbbbbbb-0000-0000-0000-000000000003'::uuid,
  'the write-off''s attribution stays with the original medic, not the admin who edited the call'
);
select is(
  (select count(*)::int from public.stock_movements where consumable_id = 'cccccccc-0000-0000-0000-000000000006'::uuid and warehouse = 'team'),
  2,
  'no new stock movement is generated when a write-off''s quantity does not actually change'
);

-- admin now changes the quantity itself: 4 -> 6
select lives_ok(
  $$ select public.update_call_with_writeoffs(
       (select id from public.calls where description = 'pgtap-marker-diff-1-renamed'),
       now(), 'pgtap-marker-diff-1-renamed', 'dddddddd-0000-0000-0000-000000000001'::uuid, 'eeeeeeee-0000-0000-0000-000000000001'::uuid,
       jsonb_build_array(jsonb_build_object('consumable_id', 'cccccccc-0000-0000-0000-000000000006', 'quantity', 6))
     ) $$,
  'admin increases the write-off quantity from 4 to 6'
);
select is(
  (select quantity from public.writeoffs where call_id = (select id from public.calls where description = 'pgtap-marker-diff-1-renamed')),
  6,
  'the write-off row is updated in place to the new quantity'
);
select is(
  (select user_id from public.writeoffs where call_id = (select id from public.calls where description = 'pgtap-marker-diff-1-renamed')),
  'bbbbbbbb-0000-0000-0000-000000000003'::uuid,
  'a quantity-only change still keeps the original medic''s attribution'
);
select is(
  (select qty_in_stock from public.team_stock where consumable_id = 'cccccccc-0000-0000-0000-000000000006'::uuid),
  14,
  'team stock reflects only the +2 delta (20 seeded - 4 original - 2 more)'
);
select is(
  (select count(*)::int from public.stock_movements where consumable_id = 'cccccccc-0000-0000-0000-000000000006'::uuid and warehouse = 'team'),
  3,
  'exactly one new movement for the delta, not a return-then-reissue pair'
);

-- writeoffs_total_since (202609070002): sums in one SQL aggregate instead
-- of the caller fetching every matching row. By this point in the file the
-- only surviving write-off in org A is the diff-test one above, at its
-- final quantity of 6 (every other call created earlier in this file was
-- deleted, cascading its write-offs away too).
select is(
  public.writeoffs_total_since('1970-01-01T00:00:00Z'::timestamptz),
  6,
  'writeoffs_total_since sums every surviving write-off in this org'
);
select is(
  public.writeoffs_total_since(now() + interval '1 day'),
  0,
  'writeoffs_total_since is 0, not null, when nothing matches'
);

select * from finish();
rollback;
