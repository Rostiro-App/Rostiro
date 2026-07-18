-- Pulse data-access operational closure (Packet 03, post-P0-hotfix,
-- 2026-07-18).
--
-- Status: PROPOSED — NOT APPLIED TO PRODUCTION. Do not run this against
-- production without separate, explicit approval.
--
-- Closes two real, currently-recurring production errors, both confirmed
-- via read-only inspection of the live database (see the accompanying
-- report — not reproduced in full here to keep this file focused):
--
-- 1. "column pulse_items.metrics_json does not exist" — real production
--    code (app/api/pulse/interrupts/route.ts, lib/pulse.ts,
--    lib/engagementTriggers.ts) already reads/writes this column; the
--    migration that was supposed to add it
--    (supabase/migration_interrupt_metrics.sql) was written but never
--    applied. This migration re-issues that exact ADD COLUMN IF NOT
--    EXISTS — idempotent, so it's harmless whichever of the two migration
--    files ends up running first.
--
-- 2. "permission denied for table {news_items|player_scratches|
--    player_context_cache|notes}" — root cause differs per table, found
--    by inspecting each table's origin migration:
--      - news_items, player_context_cache
--        (supabase/migration_player_intel.sql): RLS + policies were
--        created, but NO grant statement was ever written for either
--        table at all — RLS policies are checked only AFTER Postgres's
--        own table-level privilege check, so without the underlying
--        GRANT, every query fails at the privilege check, before RLS is
--        even consulted.
--      - player_scratches (supabase/migration_scratch_alerts.sql): same
--        gap — table+RLS+policy created, no grant. supabase/grants.sql
--        was LATER edited to include the correct grants for this table,
--        but grants.sql is a one-time "run after schema.sql for a fresh
--        environment" bootstrap script, not a migration that gets
--        re-applied to an already-running production database — so that
--        edit was never actually executed against production.
--      - notes (supabase/migration_notes.sql): grants
--        select/insert/update/delete to authenticated (this table DOES
--        work for user-facing reads/writes — confirmed 3 real rows in
--        production) but never granted anything to service_role, which
--        lib/pulse.ts's cron-path read of notes needs.
--
-- ─── Scope discipline ────────────────────────────────────────────────────
-- This migration ONLY adds grants matching operations that real, existing
-- application code already performs (verified by reading every
-- `.from('news_items'|'player_scratches'|'notes'|'player_context_cache')`
-- call site and which Supabase client — authenticated (SSR) or
-- service_role (admin) — each one uses):
--   - news_items:           authenticated reads; service_role reads AND
--                            upserts (app/api/cron/news/route.ts) — insert
--                            + update, never delete.
--   - player_scratches:     authenticated reads; service_role reads AND
--                            upserts (same cron route) — insert + update,
--                            never delete.
--   - notes:                authenticated already has full CRUD (working,
--                            unchanged here); service_role only ever
--                            reads (lib/pulse.ts's cron-path notes
--                            lookup) — no service_role write path exists
--                            in the code today.
--   - player_context_cache: authenticated reads + inserts (existing RLS
--                            policies already say exactly this);
--                            service_role reads + inserts via the same
--                            functions called from the cron path — no
--                            update/delete path exists in the code today.
-- No grant to `anon` on any of these four tables — none of them are ever
-- queried by an unauthenticated client. No RLS policy is created, altered,
-- or dropped; every existing policy on these tables is left exactly as
-- it is.
--
-- ─── Correction (2026-07-18, before this migration was ever applied) ────
-- The first version of this migration only ADDED grants. That's
-- insufficient: supabase/grants.sql runs
-- `grant all on all tables in schema public to service_role;` — and now
-- that all four tables exist in supabase/schema.sql too, a genuinely
-- fresh environment (schema.sql, then grants.sql) ends up with
-- service_role holding FULL privileges on all four tables from that one
-- blanket line, and this migration's narrower grants never revoke the
-- broader ones a later or earlier blanket grant already established —
-- GRANT is purely additive; it cannot narrow a privilege another
-- statement already gave. This version enforces the exact final set
-- instead: REVOKE ALL from anon/authenticated/service_role on each of
-- the four tables first, then grant back only what real code needs. This
-- is safe to run regardless of whatever privilege state currently exists
-- (production's real gaps, a fresh environment's blanket grant, or a
-- prior partial run of this same file) — the end state is always exactly
-- the set below.
--
-- Idempotent: REVOKE ALL is a no-op if no privileges are held; GRANT is a
-- no-op if the privilege is already held; ADD COLUMN IF NOT EXISTS is a
-- no-op if the column already exists. Safe to re-run.

begin;

-- ─── 1. pulse_items.metrics_json ────────────────────────────────────────
alter table public.pulse_items add column if not exists metrics_json jsonb;

-- ─── 2. Enforce exact privilege sets (revoke everything, then grant back
-- only what real code needs) ─────────────────────────────────────────────
revoke all privileges on public.news_items from anon, authenticated, service_role;
revoke all privileges on public.player_scratches from anon, authenticated, service_role;
revoke all privileges on public.notes from anon, authenticated, service_role;
revoke all privileges on public.player_context_cache from anon, authenticated, service_role;

-- news_items
grant select on public.news_items to authenticated;
grant select, insert, update on public.news_items to service_role;

-- player_scratches
grant select on public.player_scratches to authenticated;
grant select, insert, update on public.player_scratches to service_role;

-- notes
grant select, insert, update, delete on public.notes to authenticated;
grant select on public.notes to service_role;

-- player_context_cache
grant select, insert on public.player_context_cache to authenticated;
grant select, insert on public.player_context_cache to service_role;

do $$
declare
  v_metrics_json_present boolean;
begin
  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'pulse_items' and column_name = 'metrics_json'
  ) into v_metrics_json_present;

  raise notice 'POSTCONDITION: pulse_items.metrics_json present = %', v_metrics_json_present;
end $$;

commit;
