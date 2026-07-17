-- Per-league sync failure detail (Packet 02, Workstream C/E) — run once in
-- the Supabase SQL editor. Idempotent; safe to re-run.
--
-- sync_status already distinguishes ok/error/pending, but gives no detail
-- on WHY a league failed — the Yahoo import route (app/api/leagues/yahoo/
-- route.ts) needs to persist a safe, non-credential failure reason so the
-- "partially synced, N leagues failed" UX state (Packet 02 Workstream G)
-- can show real recovery information on a later page load, not just in the
-- one-shot API response from the sync call itself.

alter table public.connected_leagues
  add column if not exists sync_error text;
