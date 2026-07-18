// Packet 03, P3-8B: temporary compatibility alias. This route's name
// predates cross-platform Pulse (buildPulseItemsForUser has generated
// real ESPN items since P3-8) — /api/pulse is now the platform-neutral
// route new callers should use. This file stays only so any caller not
// yet migrated keeps working, byte-identical behavior guaranteed by
// re-exporting the same handler rather than duplicating it.
export { GET } from '../route'
