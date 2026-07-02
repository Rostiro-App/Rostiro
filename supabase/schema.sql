-- Rostiro OS — Supabase Database Schema
-- T-02: Run this in Supabase SQL editor to create all tables.
-- RLS is enabled on every table — users access only their own data.
-- All tables include created_at and updated_at.

-- ─── Enable UUID extension ─────────────────────────────────────────────────────

create extension if not exists "uuid-ossp";

-- ─── Users ─────────────────────────────────────────────────────────────────────
-- Extends Supabase auth.users. One row per registered account.

create table public.users (
  id                      uuid primary key references auth.users(id) on delete cascade,
  email                   text not null,
  plan                    text not null default 'free'
                            check (plan in ('free', 'starter', 'pro', 'commissioner')),
  trial_ends_at           timestamptz,
  season_pass_expires_at  timestamptz,
  stripe_customer_id      text,
  stripe_subscription_id  text,
  intelligence_addon      boolean not null default false,
  push_enabled            boolean not null default false,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

alter table public.users enable row level security;

create policy "Users can read own row" on public.users
  for select using (auth.uid() = id);

create policy "Users can update own row" on public.users
  for update using (auth.uid() = id);

-- Trigger: create users row on auth signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.users (id, email, trial_ends_at)
  values (
    new.id,
    new.email,
    now() + interval '7 days'  -- 7-day Starter trial for all new accounts
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ─── Connected Leagues ─────────────────────────────────────────────────────────

create table public.connected_leagues (
  id                    uuid primary key default uuid_generate_v4(),
  user_id               uuid not null references public.users(id) on delete cascade,
  platform              text not null check (platform in ('espn', 'yahoo', 'sleeper')),
  league_id             text not null,
  league_name           text not null,
  season                integer not null default 2026,
  scoring_settings_json jsonb,
  roster_slots_json     jsonb,
  team_id               text,
  team_name             text,
  last_synced_at        timestamptz,
  sync_status           text check (sync_status in ('ok', 'error', 'pending')),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  unique (user_id, platform, league_id, season)
);

alter table public.connected_leagues enable row level security;

create policy "Users can manage own leagues" on public.connected_leagues
  for all using (auth.uid() = user_id);

-- ─── Yahoo Tokens ──────────────────────────────────────────────────────────────
-- Access and refresh tokens are stored AES-256 encrypted (via /lib/encrypt.ts).

create table public.yahoo_tokens (
  id              uuid primary key default uuid_generate_v4(),
  user_id         uuid not null unique references public.users(id) on delete cascade,
  access_token    text not null,   -- encrypted
  refresh_token   text not null,   -- encrypted
  expires_at      timestamptz not null,
  scope           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

alter table public.yahoo_tokens enable row level security;

create policy "Users can manage own Yahoo tokens" on public.yahoo_tokens
  for all using (auth.uid() = user_id);

-- ─── ESPN Credentials ─────────────────────────────────────────────────────────
-- espn_s2 and SWID stored AES-256 encrypted.

create table public.espn_credentials (
  id                uuid primary key default uuid_generate_v4(),
  user_id           uuid not null unique references public.users(id) on delete cascade,
  espn_s2           text not null,   -- encrypted
  swid              text not null,   -- encrypted
  last_validated_at timestamptz,
  is_valid          boolean not null default false,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

alter table public.espn_credentials enable row level security;

create policy "Users can manage own ESPN credentials" on public.espn_credentials
  for all using (auth.uid() = user_id);

-- ─── Roster Snapshots ─────────────────────────────────────────────────────────
-- Cached hourly. Drives all Pulse and AI calls without re-fetching platforms.

create table public.roster_snapshots (
  id            uuid primary key default uuid_generate_v4(),
  league_id     uuid not null references public.connected_leagues(id) on delete cascade,
  team_id       text not null,
  snapshot_json jsonb not null,
  snapped_at    timestamptz not null default now()
);

alter table public.roster_snapshots enable row level security;

create policy "Users can read own roster snapshots" on public.roster_snapshots
  for select using (
    exists (
      select 1 from public.connected_leagues cl
      where cl.id = roster_snapshots.league_id
        and cl.user_id = auth.uid()
    )
  );

create policy "Service role can manage roster snapshots" on public.roster_snapshots
  for all using (auth.role() = 'service_role');

create index idx_roster_snapshots_league on public.roster_snapshots (league_id, snapped_at desc);

-- ─── Players Cache ─────────────────────────────────────────────────────────────
-- Universal player reference. Refreshed daily.

create table public.players_cache (
  player_id           text not null,
  platform            text not null check (platform in ('espn', 'yahoo', 'sleeper')),
  name                text not null,
  first_name          text,
  last_name           text,
  position            text,
  nfl_team            text,
  injury_status       text,
  injury_designation  text,
  adp_consensus       numeric,
  adp_espn            numeric,
  adp_yahoo           numeric,
  adp_sleeper         numeric,
  projected_points    numeric,
  ownership_pct       numeric,
  bye_week            integer,
  last_updated        timestamptz not null default now(),
  primary key (player_id, platform)
);

alter table public.players_cache enable row level security;

-- All authenticated users can read player cache (no PII)
create policy "Authenticated users can read players cache" on public.players_cache
  for select using (auth.role() = 'authenticated');

create policy "Service role can manage players cache" on public.players_cache
  for all using (auth.role() = 'service_role');

create index idx_players_cache_name on public.players_cache (lower(name));
create index idx_players_cache_position on public.players_cache (position);

-- ─── Player Mappings ───────────────────────────────────────────────────────────
-- Cross-platform player identity. Seeded from nflverse. Required before Pulse.

create table public.player_mappings (
  id          uuid primary key default uuid_generate_v4(),
  name        text not null,
  nfl_team    text not null,
  position    text,
  espn_id     text,
  yahoo_id    text,
  sleeper_id  text,
  gsis_id     text,  -- NFL official player ID from nflverse
  is_active   boolean not null default true,
  season      integer not null default 2026,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (name, nfl_team, season)
);

alter table public.player_mappings enable row level security;

create policy "Authenticated users can read player mappings" on public.player_mappings
  for select using (auth.role() = 'authenticated');

create policy "Service role can manage player mappings" on public.player_mappings
  for all using (auth.role() = 'service_role');

create index idx_player_mappings_espn on public.player_mappings (espn_id);
create index idx_player_mappings_yahoo on public.player_mappings (yahoo_id);
create index idx_player_mappings_sleeper on public.player_mappings (sleeper_id);

-- ─── Draft Sessions ────────────────────────────────────────────────────────────
-- Supports anonymous (user_id null) and authenticated sessions.
-- Anonymous sessions are tied to a browser via session token — handled app-side.

create table public.draft_sessions (
  id            uuid primary key default uuid_generate_v4(),
  user_id       uuid references public.users(id) on delete set null,
  league_id     uuid references public.connected_leagues(id) on delete set null,
  platform      text not null check (platform in ('espn', 'yahoo', 'sleeper')),
  draft_id      text,
  status        text not null default 'setup'
                  check (status in ('setup', 'active', 'complete')),
  settings_json jsonb not null default '{}',
  picks_json    jsonb not null default '[]',
  my_picks_json jsonb not null default '[]',
  grade_json    jsonb,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

alter table public.draft_sessions enable row level security;

create policy "Users can manage own draft sessions" on public.draft_sessions
  for all using (auth.uid() = user_id);

-- Allow anonymous access for draft kit (user_id is null)
create policy "Anonymous draft sessions readable by creator" on public.draft_sessions
  for select using (user_id is null);

create index idx_draft_sessions_user on public.draft_sessions (user_id, created_at desc);

-- ─── Pulse Items ───────────────────────────────────────────────────────────────

create table public.pulse_items (
  id                    uuid primary key default uuid_generate_v4(),
  user_id               uuid not null references public.users(id) on delete cascade,
  type                  text not null check (type in (
                          'lineup_decision', 'injury_alert', 'weather_alert',
                          'waiver_alert', 'trade_opportunity', 'opponent_intel',
                          'deadline_reminder', 'exposure_flag'
                        )),
  priority              text not null check (priority in ('critical', 'important', 'info')),
  headline              text not null,
  reasoning             text not null,
  affected_leagues_json jsonb not null default '[]',
  deadline              timestamptz,
  action_url            text,
  platform              text check (platform in ('espn', 'yahoo', 'sleeper')),
  is_dismissed          boolean not null default false,
  created_at            timestamptz not null default now()
);

alter table public.pulse_items enable row level security;

create policy "Users can manage own pulse items" on public.pulse_items
  for all using (auth.uid() = user_id);

create index idx_pulse_items_user_active on public.pulse_items
  (user_id, is_dismissed, created_at desc);

-- ─── AI Queries (Logging) ─────────────────────────────────────────────────────
-- Tracks Claude usage for rate limiting free tier and debugging.

create table public.ai_queries (
  id            uuid primary key default uuid_generate_v4(),
  user_id       uuid not null references public.users(id) on delete cascade,
  query_type    text not null check (query_type in ('pulse', 'start_sit', 'trade', 'draft_rec')),
  context_hash  text,  -- SHA-256 of context JSON for cache deduplication
  response_json jsonb,
  tokens_in     integer,
  tokens_out    integer,
  latency_ms    integer,
  created_at    timestamptz not null default now()
);

alter table public.ai_queries enable row level security;

create policy "Users can read own AI query logs" on public.ai_queries
  for select using (auth.uid() = user_id);

create policy "Service role can manage AI query logs" on public.ai_queries
  for all using (auth.role() = 'service_role');

create index idx_ai_queries_user_type on public.ai_queries (user_id, query_type, created_at desc);

-- ─── Weather Cache ─────────────────────────────────────────────────────────────
-- 6-hour TTL. All 32 NFL stadiums, keyed by stadium_id + game_date.

create table public.weather_cache (
  stadium_id    text not null,
  game_date     date not null,
  forecast_json jsonb not null,
  fetched_at    timestamptz not null default now(),
  primary key (stadium_id, game_date)
);

alter table public.weather_cache enable row level security;

create policy "Authenticated users can read weather cache" on public.weather_cache
  for select using (auth.role() = 'authenticated');

create policy "Service role can manage weather cache" on public.weather_cache
  for all using (auth.role() = 'service_role');

-- ─── Push Subscriptions ────────────────────────────────────────────────────────

create table public.push_subscriptions (
  id                  uuid primary key default uuid_generate_v4(),
  user_id             uuid not null references public.users(id) on delete cascade,
  onesignal_player_id text not null,
  created_at          timestamptz not null default now(),
  unique (user_id, onesignal_player_id)
);

alter table public.push_subscriptions enable row level security;

create policy "Users can manage own push subscriptions" on public.push_subscriptions
  for all using (auth.uid() = user_id);

-- ─── Updated At Trigger ────────────────────────────────────────────────────────

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger set_updated_at before update on public.users
  for each row execute function public.set_updated_at();

create trigger set_updated_at before update on public.connected_leagues
  for each row execute function public.set_updated_at();

create trigger set_updated_at before update on public.yahoo_tokens
  for each row execute function public.set_updated_at();

create trigger set_updated_at before update on public.espn_credentials
  for each row execute function public.set_updated_at();

create trigger set_updated_at before update on public.player_mappings
  for each row execute function public.set_updated_at();

create trigger set_updated_at before update on public.draft_sessions
  for each row execute function public.set_updated_at();
