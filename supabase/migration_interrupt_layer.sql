-- The Interrupt Stack (T-106, PRD 7.1) — run once in the Supabase SQL
-- editor. Idempotent; safe to re-run.
--
-- Distinguishes 7.1's Interrupt layer (transient, "one slot at a time,"
-- rendered by components/InterruptStack.tsx) from the Action layer (the
-- persistent Pulse queue with Done/Snooze/Dismiss). Default 'action' means
-- every existing row and every future insert that doesn't explicitly opt
-- in stays exactly where it already renders today — this is additive,
-- not a reclassification of anything that already exists.

alter table public.pulse_items
  add column if not exists layer text not null default 'action'
  check (layer in ('action', 'interrupt'));

create index if not exists pulse_items_interrupt_idx
  on public.pulse_items (user_id, layer, status)
  where layer = 'interrupt';
