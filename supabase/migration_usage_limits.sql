-- Free/Pro usage quota enforcement (T-103, PRD Section 9) — run once in the
-- Supabase SQL editor. Idempotent; safe to re-run.
--
-- Backs lib/usageLimits.ts's checkAndIncrementUsage(). One row per
-- (user, feature, calendar week) — "feature" is a free-text key
-- ('start_sit', 'trade_analysis') rather than an enum, since new gated
-- features will keep appearing and shouldn't need a migration each time.
-- week_start is the Monday of the ISO week, computed the same way in
-- lib/usageLimits.ts and here — not enforced by the DB, just a convention
-- both sides agree on.

create table if not exists public.usage_counters (
  user_id    uuid not null references public.users(id) on delete cascade,
  feature    text not null,
  week_start date not null,
  count      integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, feature, week_start)
);

alter table public.usage_counters enable row level security;

drop policy if exists "Users can read own usage" on public.usage_counters;
create policy "Users can read own usage" on public.usage_counters
  for select using (auth.uid() = user_id);

drop policy if exists "Service role can manage usage" on public.usage_counters;
create policy "Service role can manage usage" on public.usage_counters
  for all using (auth.role() = 'service_role');

grant select on public.usage_counters to authenticated;
grant select, insert, update, delete on public.usage_counters to service_role;
