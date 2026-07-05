-- T-111 follow-up (July 5, 2026): adds the 'big_play' event tier —
-- a large positive point jump below touchdown magnitude (e.g. a long
-- catch or run without a score). Founder-flagged gap: a 66-yard catch
-- was previously bucketed into the same generic 'yardage' class as a
-- 4-yard run, so it never got the takeover treatment or clear copy.
-- Idempotent: safe to re-run.

alter table live_events drop constraint if exists live_events_event_type_check;
alter table live_events add constraint live_events_event_type_check
  check (event_type in ('touchdown', 'big_play', 'reception', 'yardage', 'negative'));
