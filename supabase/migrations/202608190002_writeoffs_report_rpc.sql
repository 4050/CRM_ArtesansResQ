-- getWriteoffsInRange pulled up to 5000 raw rows and summed/grouped them in
-- JS - a report over a wider date range than that silently produced
-- under-counted totals and an incomplete per-item breakdown, with nothing
-- telling the admin it happened. Move the aggregation into SQL so it covers
-- every matching row regardless of how many there are.
--
-- security invoker (the default - not stated explicitly elsewhere in this
-- file for that reason): unlike the RPCs above, this doesn't need to bypass
-- RLS, it just runs the same read the client already does via
-- "Authenticated read writeoffs"/"Authenticated read consumables" - the
-- explicit organization_id filter is redundant with RLS but kept for
-- clarity and defense in depth, same reasoning as elsewhere in this file.
create or replace function public.writeoffs_report(p_from timestamptz, p_to timestamptz)
returns jsonb
language sql
stable
set search_path = ''
as $$
  with scoped as (
    select w.quantity, w.user_id, c.name, c.unit, c.category, c.source
    from public.writeoffs w
    left join public.consumables c on c.id = w.consumable_id
    where w.organization_id = public.current_org_id()
      and w.created_at >= p_from
      and w.created_at <= p_to
  ),
  breakdown as (
    select name, unit, category, source, sum(quantity)::bigint as quantity
    from scoped
    group by name, unit, category, source
    order by sum(quantity) desc
  )
  select jsonb_build_object(
    'operations', (select count(*) from scoped),
    'totalQuantity', (select coalesce(sum(quantity), 0) from scoped),
    'employees', (select count(distinct user_id) from scoped),
    'byConsumable', (select coalesce(jsonb_agg(to_jsonb(breakdown)), '[]'::jsonb) from breakdown)
  );
$$;

revoke all on function public.writeoffs_report(timestamptz, timestamptz) from public;
grant execute on function public.writeoffs_report(timestamptz, timestamptz) to authenticated;
