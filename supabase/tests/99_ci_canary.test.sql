-- TEMPORARY - proves pg_prove actually fails the job on a failing
-- assertion (unlike plain psql). Removed in a follow-up commit on this
-- same branch once CI is confirmed red.
begin;
select plan(1);
select ok(false, 'ci-canary-must-fail');
select * from finish();
rollback;
