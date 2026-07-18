-- Run this in Supabase SQL Editor immediately after schema.sql
-- Grants PostgREST access to all roles for the tables we created.

grant usage on schema public to anon, authenticated, service_role;

-- service_role: full access to everything (used server-side only)
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;

-- public.news_items, public.player_scratches, public.notes,
-- public.player_context_cache: EXCEPTIONS to the blanket service_role
-- grant just above. Packet 03 operational-closure correction
-- (migration_pulse_data_access_closure.sql) — GRANT is purely additive,
-- so the blanket `grant all` two lines up would otherwise leave
-- service_role with full CRUD on these four tables forever, no matter
-- what narrower grant appears later in this file. REVOKE ALL first, then
-- grant back only what real application code actually does (verified by
-- reading every `.from(...)` call site on these tables and which
-- Supabase client — authenticated SSR or service_role admin — each one
-- uses) — this is the only way to make a narrower-than-blanket set stick.
-- No grant to anon on any of these four; RLS policies are unchanged (see
-- each table's own create-policy statement below).
revoke all privileges on public.news_items from anon, authenticated, service_role;
revoke all privileges on public.player_scratches from anon, authenticated, service_role;
revoke all privileges on public.notes from anon, authenticated, service_role;
revoke all privileges on public.player_context_cache from anon, authenticated, service_role;

grant select on public.news_items to authenticated;
grant select, insert, update on public.news_items to service_role;

grant select on public.player_scratches to authenticated;
grant select, insert, update on public.player_scratches to service_role;

grant select, insert, update, delete on public.notes to authenticated;
grant select on public.notes to service_role;

grant select, insert on public.player_context_cache to authenticated;
grant select, insert on public.player_context_cache to service_role;

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

-- public.news_items, public.player_scratches, public.notes,
-- public.player_context_cache: see the consolidated revoke+grant block
-- right after the blanket service_role grant near the top of this file —
-- that block (not here) is authoritative for these four tables' final
-- privilege set, specifically so it runs AFTER the blanket grant and can
-- actually narrow it.
