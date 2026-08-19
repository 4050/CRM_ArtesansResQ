-- "Authenticated insert own calls"/"Authenticated insert own writeoffs" let
-- any authenticated org member INSERT directly into these tables via
-- PostgREST, not just through create_call_with_writeoffs/
-- update_call_with_writeoffs (both security definer, so they don't need
-- these policies to do their own writes - see 202607170006). Writing
-- through the RPCs is the only path the app actually uses, and it's also
-- the only path that keeps team_stock and the writeoffs it produces in
-- sync (adjust_team_stock is called alongside every writeoffs insert). A
-- direct insert bypasses that entirely - same class of gap already closed
-- for team_stock in 202607170015.
--
-- Match writeoffs to the same RPC-only treatment team_stock already got.
drop policy if exists "Authenticated insert own calls" on public.calls;
drop policy if exists "Authenticated insert own writeoffs" on public.writeoffs;

-- Defense in depth, same reasoning as consumables_qty_in_stock_nonneg in
-- 202607170009: the RPCs already reject a non-positive quantity, but that
-- check is only as good as the one call path we know about today.
alter table public.writeoffs add constraint writeoffs_quantity_positive check (quantity > 0);
