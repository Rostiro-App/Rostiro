-- Post-draft "roster grade" Pulse item (found missing from a real user
-- audit, July 4, 2026 — PRD line 737 promises "roster grade appears in
-- Pulse even without a full Portfolio product at MVP," never actually
-- built). Run once in the Supabase SQL editor. Idempotent; safe to re-run.
--
-- Same pattern as migration_engagement_triggers.sql — drop + recreate the
-- type check constraint with the one new value added.

alter table public.pulse_items drop constraint if exists pulse_items_type_check;
alter table public.pulse_items add constraint pulse_items_type_check check (type in (
  'lineup_decision', 'injury_alert', 'weather_alert', 'waiver_alert', 'trade_opportunity',
  'opponent_intel', 'deadline_reminder', 'exposure_flag',
  'touchdown_swing', 'lineup_lock', 'mission_complete',
  'roster_grade'
));
