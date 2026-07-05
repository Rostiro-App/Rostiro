-- Player Intelligence / Opportunity Surge (PRD 6.11 T-89, 7.1 T-99) — run
-- once in the Supabase SQL editor. Idempotent; safe to re-run.
--
-- depth_chart_order/position: real NFL depth chart data, confirmed present
-- on Sleeper's player payload live (July 5, 2026) — this is what makes
-- "starter goes down, who benefits" a deterministic join instead of a
-- Claude-guessing problem.
--
-- news_items: ESPN NFL RSS ingestion (espn.com/espn/rss/nfl/news). Per
-- ESPN's own stated terms, we store only what the feed provides (headline
-- + their excerpt), never full article text, and always link back —
-- syndication, not republishing.
--
-- player_context_cache: Claude's one-sentence "why this matters" per
-- (player x news item) or per opportunity-surge event, generated once and
-- reused for every user who rosters that player — not per-user, per-view.

alter table public.players_cache add column if not exists depth_chart_order integer;
alter table public.players_cache add column if not exists depth_chart_position text;

create table if not exists public.news_items (
  id           text primary key,
  source       text not null default 'espn',
  headline     text not null,
  summary      text,
  author       text,
  link         text not null,
  published_at timestamptz not null,
  player_ids   text[] not null default '{}',
  created_at   timestamptz not null default now()
);

create index if not exists news_items_published_idx on public.news_items (published_at desc);
create index if not exists news_items_player_ids_idx on public.news_items using gin (player_ids);

alter table public.news_items enable row level security;
drop policy if exists "Authenticated users can read news items" on public.news_items;
create policy "Authenticated users can read news items" on public.news_items
  for select using (auth.role() = 'authenticated');

create table if not exists public.player_context_cache (
  id         uuid primary key default gen_random_uuid(),
  player_id  text not null,
  platform   text not null default 'sleeper',
  kind       text not null check (kind in ('news', 'opportunity_surge')),
  source_id  text not null,
  reasoning  text not null,
  created_at timestamptz not null default now(),
  unique (player_id, platform, kind, source_id)
);

alter table public.player_context_cache enable row level security;
drop policy if exists "Authenticated users can read player context cache" on public.player_context_cache;
create policy "Authenticated users can read player context cache" on public.player_context_cache
  for select using (auth.role() = 'authenticated');

-- Written by whichever request first computes a given (player x event)'s
-- reasoning — the on-demand Pulse route (user-scoped SSR client) or the
-- daily cron (service role) — so authenticated users need insert, not just
-- select. Content is public NFL commentary, never user data, so this is
-- safe to leave open the same way players_cache already is.
drop policy if exists "Authenticated users can write player context cache" on public.player_context_cache;
create policy "Authenticated users can write player context cache" on public.player_context_cache
  for insert with check (auth.role() = 'authenticated');

-- Adds player_news + opportunity_surge to the existing type list
-- (migration_roster_grade.sql already added roster_grade).
alter table public.pulse_items drop constraint if exists pulse_items_type_check;
alter table public.pulse_items add constraint pulse_items_type_check check (type in (
  'lineup_decision', 'injury_alert', 'weather_alert', 'waiver_alert', 'trade_opportunity',
  'opponent_intel', 'deadline_reminder', 'exposure_flag',
  'touchdown_swing', 'lineup_lock', 'mission_complete',
  'roster_grade', 'player_news', 'opportunity_surge'
));
