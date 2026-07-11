-- Run this in Supabase SQL Editor immediately after schema.sql
-- Grants PostgREST access to all roles for the tables we created.

grant usage on schema public to anon, authenticated, service_role;

-- service_role: full access to everything (used server-side only)
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;

-- authenticated: full access to their own rows (RLS enforces row-level isolation)
grant select, insert, update, delete on
  public.users,
  public.connected_leagues,
  public.yahoo_tokens,
  public.espn_credentials,
  public.roster_snapshots,
  public.draft_sessions,
  public.pulse_items,
  public.ai_queries,
  public.push_subscriptions
to authenticated;

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

-- service_role: admin-written tables (cron, backend only)
grant select, insert, update, delete on public.player_scratches to service_role;
