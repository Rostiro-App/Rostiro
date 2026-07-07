-- T-100 (PRD 7.1): Console/Pulse engagement telemetry — run once in the
-- Supabase SQL editor. Idempotent; safe to re-run.
--
-- Backs lib/telemetry.ts / app/api/telemetry/route.ts. An append-only raw
-- event log, not a dashboard — "feeds retention measurement without new
-- UI" per the task's own scope, so this ships instrumentation only.
-- Aggregate metrics (session duration, P0 action rate, dismiss rate) are
-- computed later directly against this table, not maintained as running
-- counters here.
--
-- event_type covers the four things 7.1 asks for:
--   game_day_session_open / game_day_session_close  — session opens +
--     time-in-Game-Day-state (close carries duration_ms in metadata,
--     computed client-side from the open timestamp already in hand)
--   interrupt_shown / interrupt_action               — P0 alert action
--     rate: shown is the denominator, action (dismiss/snooze) the
--     numerator; a critical interrupt never auto-dismisses, so any
--     action on one is always a real user response, never a timeout
--   pulse_item_action                                 — notification
--     mute/dismiss rate: every done/dismiss/snooze on an ordinary Pulse
--     item, same action vocabulary already used by
--     app/api/pulse/items/[id]/route.ts

create table if not exists public.telemetry_events (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.users(id) on delete cascade,
  event_type text not null check (event_type in (
    'game_day_session_open',
    'game_day_session_close',
    'interrupt_shown',
    'interrupt_action',
    'pulse_item_action'
  )),
  metadata   jsonb not null default '{}',
  created_at timestamptz not null default now()
);

alter table public.telemetry_events enable row level security;

-- Authenticated client writes its own events directly (no admin-only
-- write path — these fire from ordinary page/component code, not a cron),
-- same posture as pulse_items' own RLS.
drop policy if exists "Users can insert own telemetry events" on public.telemetry_events;
create policy "Users can insert own telemetry events" on public.telemetry_events
  for insert with check (auth.uid() = user_id);

drop policy if exists "Service role can manage telemetry events" on public.telemetry_events;
create policy "Service role can manage telemetry events" on public.telemetry_events
  for all using (auth.role() = 'service_role');

grant insert on public.telemetry_events to authenticated;
grant select, insert, update, delete on public.telemetry_events to service_role;

create index if not exists idx_telemetry_events_type_time on public.telemetry_events (event_type, created_at desc);
create index if not exists idx_telemetry_events_user on public.telemetry_events (user_id, created_at desc);
