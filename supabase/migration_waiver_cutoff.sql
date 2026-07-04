-- Per-league waiver-cutoff config (T-107, PRD 6.10 "detects the specific
-- cutoff per league rather than assuming one universal day") — run once in
-- the Supabase SQL editor. Idempotent; safe to re-run.
--
-- Both nullable, both null by default — that's "use the existing global
-- Tue/Wed fallback" (lib/rostiroState.ts), not a new required field. Only a
-- league whose commissioner/user has actually configured a real cutoff
-- overrides it. day_of_week: 0=Sunday..6=Saturday, matching JS's own
-- getUTCDay() convention already used throughout lib/rostiroState.ts.

alter table public.connected_leagues
  add column if not exists waiver_cutoff_day smallint
  check (waiver_cutoff_day is null or (waiver_cutoff_day >= 0 and waiver_cutoff_day <= 6));

alter table public.connected_leagues
  add column if not exists waiver_cutoff_hour smallint
  check (waiver_cutoff_hour is null or (waiver_cutoff_hour >= 0 and waiver_cutoff_hour <= 23));
