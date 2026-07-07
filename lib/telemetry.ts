// T-100 (PRD 7.1): client-side fire-and-forget event logging — instruments
// Game Day session opens/duration, P0 interrupt action rate, and Pulse
// item dismiss/mute rate so retention can actually be measured. No new
// UI; this only ever writes rows for later analysis (migration_telemetry.sql).
// Never blocks or throws back at the caller — a dropped telemetry event
// is never worth breaking the feature it's instrumenting.

export type TelemetryEventType =
  | 'game_day_session_open'
  | 'game_day_session_close'
  | 'interrupt_shown'
  | 'interrupt_action'
  | 'pulse_item_action'

export function logTelemetryEvent(eventType: TelemetryEventType, metadata?: Record<string, unknown>): void {
  fetch('/api/telemetry', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ eventType, metadata: metadata ?? {} }),
  }).catch(() => {})
}
