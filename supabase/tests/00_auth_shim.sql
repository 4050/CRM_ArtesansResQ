-- Run BEFORE schema.sql. Two things schema.sql depends on that plain
-- Postgres doesn't provide: the auth.users table (FK target + source of
-- the on_auth_user_created trigger) and auth.uid(). The real Supabase
-- auth.uid() reads the "sub" claim off the request JWT via a GUC that
-- PostgREST sets per request (request.jwt.claim.sub) - this stub reads the
-- exact same GUC, so tests.authenticate_as() (used by every *.test.sql
-- file) simulates "logged in as this user" faithfully rather than
-- inventing a parallel mechanism.
create extension if not exists pgtap;

-- schema.sql's RLS policies and function grants target the "authenticated"
-- Postgres role, which Supabase provisions out of the box but a plain
-- postgres:16 instance (as used here and in CI) does not. Create it as a
-- plain, non-login role - nothing here ever connects as it, policies just
-- check membership - guarded so re-running this file locally is safe.
do $$
begin
  if not exists (select from pg_roles where rolname = 'authenticated') then
    create role authenticated;
  end if;
end
$$;

-- A real Supabase project pre-grants baseline table privileges to
-- "authenticated" platform-wide - CREATE POLICY ... TO authenticated only
-- ever narrows which rows are visible on top of a privilege that must
-- already exist, it grants no table-level access by itself. schema.sql
-- doesn't grant these itself because it assumes that platform default is
-- already there; this bare postgres instance has no such default, so
-- replicate it here, before schema.sql creates any tables, via ALTER
-- DEFAULT PRIVILEGES so every public.* table it goes on to create picks
-- this up automatically. Without this, a test that runs a query directly
-- as "authenticated" (see tests/08_restrict_access.test.sql) would fail
-- with "permission denied for table ..." rather than actually exercising
-- RLS.
grant usage on schema public to authenticated;
alter default privileges in schema public
  grant select, insert, update, delete on tables to authenticated;

create schema if not exists auth;

create table auth.users (
  id uuid primary key default gen_random_uuid(),
  email text,
  raw_user_meta_data jsonb not null default '{}'::jsonb
);

create or replace function auth.uid() returns uuid
language sql stable
as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;

create schema if not exists tests;

create or replace function tests.authenticate_as(p_user_id uuid) returns void
language sql
as $$
  select set_config('request.jwt.claim.sub', p_user_id::text, true);
$$;

create or replace function tests.clear_auth() returns void
language sql
as $$
  select set_config('request.jwt.claim.sub', '', true);
$$;
