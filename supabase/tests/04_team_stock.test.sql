-- Fixtures (from 00_setup.sql):
--   admin_a = bbbbbbbb-...-0002 (org A)
--
-- Covers transfer_to_team_stock and delete_team_stock_item.
-- return_from_team_stock/discard_from_team_stock still need coverage here.
begin;
select plan(9);

select tests.authenticate_as('bbbbbbbb-0000-0000-0000-000000000002');

insert into public.consumables (id, code, name, unit, qty_in_stock, qty_minimum, organization_id)
values ('cccccccc-0000-0000-0000-000000000002', 'TST-002', 'Test Gauze', 'pcs', 20, 2, 'aaaaaaaa-0000-0000-0000-000000000001');

select lives_ok(
  $$ select public.transfer_to_team_stock('cccccccc-0000-0000-0000-000000000002'::uuid, 5) $$,
  'admin can issue stock to the team'
);
select is(
  (select qty_in_stock from public.consumables where id = 'cccccccc-0000-0000-0000-000000000002'::uuid),
  15,
  'main warehouse decreased by the issued amount'
);
select is(
  (select qty_in_stock from public.team_stock where consumable_id = 'cccccccc-0000-0000-0000-000000000002'::uuid),
  5,
  'team stock increased by the issued amount'
);

select throws_like(
  $$ select public.transfer_to_team_stock('cccccccc-0000-0000-0000-000000000002'::uuid, 999) $$,
  'Not enough%in stock%',
  'issuing more than what''s in the main warehouse is rejected'
);

select throws_like(
  $$ select public.delete_team_stock_item('cccccccc-0000-0000-0000-000000000002'::uuid) $$,
  'Return or discard%before removing%',
  'deleting a team-stock item with remaining stock is rejected'
);

select lives_ok(
  $$ select public.discard_from_team_stock('cccccccc-0000-0000-0000-000000000002'::uuid, 5) $$,
  'admin can discard the remaining team stock down to zero'
);

select lives_ok(
  $$ select public.delete_team_stock_item('cccccccc-0000-0000-0000-000000000002'::uuid) $$,
  'admin can delete a team-stock item once its quantity is zero'
);

select is(
  (select count(*)::int from public.team_stock where consumable_id = 'cccccccc-0000-0000-0000-000000000002'::uuid),
  0,
  'team_stock row is gone after deletion'
);

select throws_like(
  $$ select public.delete_team_stock_item('cccccccc-0000-0000-0000-000000000002'::uuid) $$,
  'Item not found in team stock',
  'deleting an already-removed item is rejected'
);

select * from finish();
rollback;
