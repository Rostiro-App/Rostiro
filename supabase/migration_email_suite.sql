-- Email suite (2026-07-08) — run once in the Supabase SQL editor. Idempotent.
--
-- Backs the "Season Pass expiring soon" reminder email: the cron in
-- app/api/cron/season-pass-expiry/route.ts needs to fire that reminder
-- exactly once per user, not every day the cron runs while a user is in
-- the 6-8-day warning window. This column is the one-shot guard — null
-- until the reminder is sent, then set, same pattern as any other
-- "already notified" flag.

alter table public.users
  add column if not exists season_pass_expiry_warned_at timestamptz;
