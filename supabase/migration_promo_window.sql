-- Global "free Pro week" promo window (business decision, July 2026: the
-- 7-day-from-signup trial was firing during the dead offseason — a July
-- signup burned their whole trial before the season even started, with
-- nothing left to convert them once real value existed in September).
-- Run once in the Supabase SQL editor. Idempotent; safe to re-run.
--
-- Singleton, same pattern as sim_state (migration_simulation.sql) — one
-- row, id=1. Deliberately a SEPARATE table from sim_state: this is a real,
-- persistent production lever the founder sets once for the season, not a
-- dev/test scenario — "Clear simulation" in the Dev Simulation Suite must
-- never accidentally wipe it.
--
-- Backs lib/usageLimits.ts's isFreePlan: while now() is between starts_at
-- and ends_at, every nominally-free user gets full Pro depth, regardless
-- of when they signed up — the mechanic that actually fixes the timing
-- mismatch, since it's anchored to the real season calendar instead of
-- each user's individual signup date.

create table if not exists public.promo_windows (
  id         integer primary key default 1,
  starts_at  timestamptz,
  ends_at    timestamptz,
  label      text,
  updated_at timestamptz not null default now(),
  constraint promo_windows_singleton check (id = 1)
);

insert into public.promo_windows (id) values (1) on conflict (id) do nothing;

alter table public.promo_windows enable row level security;

-- Read-only for any signed-in client — no PII, just two dates, and
-- lib/usageLimits.ts's isFreePlan is called with either an SSR-scoped or
-- admin client depending on the caller, so this needs to work for both
-- without a second admin-client instantiation just for this one lookup.
drop policy if exists "Authenticated users can read the promo window" on public.promo_windows;
create policy "Authenticated users can read the promo window" on public.promo_windows
  for select using (auth.role() = 'authenticated');

drop policy if exists "Service role can manage the promo window" on public.promo_windows;
create policy "Service role can manage the promo window" on public.promo_windows
  for all using (auth.role() = 'service_role');

grant select on public.promo_windows to authenticated;
grant select, insert, update, delete on public.promo_windows to service_role;
