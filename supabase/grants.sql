-- Run this in Supabase SQL Editor immediately after schema.sql
-- Grants PostgREST access to all roles for the tables we created.

grant usage on schema public to anon, authenticated, service_role;

-- service_role: full access to everything (used server-side only)
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;

-- authenticated: full access to their own rows (RLS enforces row-level isolation)
grant select, insert, update, delete on
  public.connected_leagues,
  public.espn_credentials,
  public.roster_snapshots,
  public.draft_sessions,
  public.pulse_items,
  public.ai_queries,
  public.push_subscriptions
to authenticated;

-- public.yahoo_tokens: Packet 02 token-custody hardening
-- (migration_yahoo_token_custody.sql). Deliberately NOT included in the
-- shared grant above — encrypted OAuth tokens are server credentials even
-- ciphertext-encrypted, and every real write/read path
-- (app/api/auth/yahoo/callback/route.ts, lib/yahoo.ts's
-- getValidYahooAccessToken) already uses the service-role admin client,
-- never the user's own session. authenticated never legitimately needed
-- this table at all.
grant select, insert, update, delete on public.yahoo_tokens to service_role;

-- public.users: launch-security hardening (migration_launch_security.sql).
-- authenticated gets select on the whole row (RLS restricts to their own),
-- but insert/update/delete are NOT table-wide — server-owned columns
-- (plan, stripe_customer_id, stripe_subscription_id, trial_ends_at,
-- season_pass_expires_at, intelligence_addon, founding_number, email) must
-- only ever be written by the service role. Column-level update grants for
-- the settings a user can legitimately self-serve are in
-- migration_launch_security.sql, immediately below the table itself, so a
-- fresh environment gets the secure grants from the start rather than
-- table-wide CRUD followed by a later revoke.
grant select on public.users to authenticated;

-- authenticated read-only (shared reference data)
grant select on
  public.players_cache,
  public.player_mappings,
  public.weather_cache
to authenticated;

-- anon: read-only on shared reference data only
grant select on
  public.players_cache,
  public.player_mappings
to anon;

-- authenticated read-only: global player injury signals (no per-user data),
-- read on-demand by buildPulseItemsForUser via the authenticated SSR client
grant select on public.player_scratches to authenticated;

-- service_role: written by app/api/cron/news/route.ts's upsert — insert +
-- update only, no real delete path exists in the code today. Narrower than
-- the previous select/insert/update/delete grant here, which was never
-- actually applied to production (see
-- supabase/migration_pulse_data_access_closure.sql) — tightened to match
-- what real code does rather than carrying the blanket grant forward.
grant select, insert, update on public.player_scratches to service_role;

-- public.news_items, public.player_context_cache, public.notes: Packet 03
-- operational-closure reconciliation (migration_pulse_data_access_closure.sql).
-- news_items/player_context_cache were created by migration_player_intel.sql
-- with RLS policies but NO grant statement at all — this is the actual
-- fix for that gap, not just documentation of intent. notes already grants
-- authenticated here via migration_notes.sql; service_role's read-only
-- grant below is new (lib/pulse.ts's cron-path notes lookup needs it).
grant select on public.news_items to authenticated;
grant select, insert, update on public.news_items to service_role;

grant select, insert on public.player_context_cache to authenticated;
grant select, insert on public.player_context_cache to service_role;

grant select on public.notes to service_role;
