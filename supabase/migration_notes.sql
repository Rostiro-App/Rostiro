-- Notes (T-141/T-142) — run once in the Supabase SQL editor. Idempotent;
-- safe to re-run.
--
-- One shared table for both note types (`type` column) rather than two
-- separate features. 'general' (T-141): plain scratchpad, no AI cost at
-- write time. 'ask_copilot' (T-142, not built yet): a structured question
-- Claude answers, using `response`/`status` — those columns exist now so
-- shipping T-142 later is additive, not a migration that touches existing
-- rows.

create table if not exists public.notes (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  league_id   uuid references public.connected_leagues(id) on delete cascade,
  player_id   text,
  type        text not null default 'general' check (type in ('general', 'ask_copilot')),
  body        text not null,
  response    text,
  status      text not null default 'n/a' check (status in ('n/a', 'pending', 'answered', 'failed')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table public.notes enable row level security;

drop policy if exists "Users can manage their own notes" on public.notes;
create policy "Users can manage their own notes" on public.notes
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

grant select, insert, update, delete on public.notes to authenticated;

create index if not exists idx_notes_user_created on public.notes (user_id, created_at desc);
create index if not exists idx_notes_league on public.notes (league_id) where league_id is not null;
