-- Баг: dashboard'ская карточка "списано сегодня" тянула КАЖДУЮ строку
-- списания за сегодня (lib/data/writeoffs.ts's getWriteoffsSince) и
-- суммировала их в JS - без собственного лимита. PostgREST по умолчанию
-- режет выдачу на 1000 строк, так что при достаточно активном дне итог
-- тихо занижался бы. writeoffs_report уже решает эту же задачу агрегацией
-- прямо в SQL (см. 202608190002) - тот же приём здесь.

create or replace function public.writeoffs_total_since(p_since timestamptz)
returns integer
language sql
stable
set search_path = ''
as $$
  select coalesce(sum(quantity), 0)::integer
  from public.writeoffs
  where organization_id = public.current_org_id()
    and created_at >= p_since;
$$;

revoke all on function public.writeoffs_total_since(timestamptz) from public;
grant execute on function public.writeoffs_total_since(timestamptz) to authenticated;
