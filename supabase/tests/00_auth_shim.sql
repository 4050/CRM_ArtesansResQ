-- Run BEFORE schema.sql. Two things schema.sql depends on that plain
-- Postgres doesn't provide: the auth.users table (FK target + source of
-- the on_auth_user_created trigger) and auth.uid(). The real Supabase
-- auth.uid() reads the "sub" claim off the request JWT via a GUC that
-- PostgREST sets per request (request.jwt.claim.sub) - this stub reads the
-- exact same GUC, so tests.authenticate_as() (used by every *.test.sql
-- file) simulates "logged in as this user" faithfully rather than
-- inventing a parallel mechanism.
create extension if not exists pgtap;

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
