-- "Owners or admins delete calls"/"Owners or admins delete writeoffs" let
-- an owner or admin DELETE these rows directly via PostgREST, not just
-- through delete_call_with_writeoffs/update_call_with_writeoffs (both
-- security definer, so they don't need these policies for their own
-- deletes - see 202608190001, which dropped the equivalent INSERT
-- policies for the same reason).
--
-- Those RPCs are the only paths that call adjust_team_stock() to give a
-- write-off's quantity back to team_stock before removing the row (or, for
-- a whole call, cascade-deleting its write-offs the same way). A direct
-- DELETE - reachable by anyone with a valid session token, not just
-- through the UI - skips that restoration entirely, silently leaving
-- team_stock understating what the team actually has on hand.
drop policy if exists "Owners or admins delete calls" on public.calls;
drop policy if exists "Owners or admins delete writeoffs" on public.writeoffs;
