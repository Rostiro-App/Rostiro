-- Marketing asset library: real screenshots (uploaded manually, same
-- Screen Studio / Simulation Studio workflow as today) and generated stat
-- cards (rendered by the cockpit's Marketing agent), indexed so
-- "find an image of Rostiro Pulse" resolves to something real.
--
-- Deliberately NOT part of the live app's user-facing schema -- no
-- anon/authenticated grant (see grants.sql's comment on this exact gotcha
-- for cron_heartbeat). Only the cockpit's dedicated service-role credential
-- (confined to src/marketingAssets/supabaseAssetsClient.ts) touches this.

create table if not exists public.marketing_assets (
  id uuid primary key default gen_random_uuid(),
  storage_path text not null,
  kind text not null check (kind in ('screenshot', 'generated_card')),
  pillar text,
  player_tags text[] not null default '{}',
  topic text,
  aspect text,
  description text,
  template_id text,
  created_at timestamptz not null default now()
);

-- Defense-in-depth: no policy is defined (service_role bypasses RLS
-- entirely regardless), but enabling RLS means that if a blanket
-- anon/authenticated grant is ever accidentally reintroduced later (the
-- exact cron_heartbeat gotcha referenced above), the table fails closed
-- instead of silently becoming accessible.
alter table public.marketing_assets enable row level security;

create index if not exists marketing_assets_pillar_idx on public.marketing_assets (pillar);
create index if not exists marketing_assets_player_tags_idx on public.marketing_assets using gin (player_tags);

-- Private bucket -- not public, no anon read. The service_role key (used
-- only inside supabaseAssetsClient.ts) bypasses RLS entirely, and signed
-- URLs are minted per-request for anything that needs to be viewed
-- (Discord embeds, Postiz media upload).
insert into storage.buckets (id, name, public)
values ('marketing-assets', 'marketing-assets', false)
on conflict (id) do nothing;

grant select, insert, update, delete on public.marketing_assets to service_role;
