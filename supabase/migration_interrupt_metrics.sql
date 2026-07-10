-- Project A: per-league win-probability metrics on interrupt Pulse items.
-- Consumed by components/InterruptStack.tsx via /api/pulse/interrupts.
ALTER TABLE pulse_items ADD COLUMN IF NOT EXISTS metrics_json jsonb;
