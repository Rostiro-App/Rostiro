import type { Platform } from '@/types'
import type { PlatformIntelligenceAdapter } from './types'
import { sleeperIntelligenceAdapter } from './sleeper'
import { espnIntelligenceAdapter } from './espn'

export type {
  PlatformCapabilities,
  NormalizedLeague,
  NormalizedLeagueStatus,
  NormalizedDraftInfo,
  NormalizedDraftStatus,
  NormalizedWaiverSettings,
  WaiverType,
  DataQualityWarning,
  LineupStatus,
  NormalizedRosterPlayer,
  NormalizedRosterSnapshot,
  MatchupStatus,
  NormalizedMatchup,
  AvailabilityState,
  NormalizedAvailablePlayer,
  IntelligenceReadStatus,
  IntelligenceReadResult,
  SnapshotFreshness,
  ConnectedLeagueContext,
  PlatformIntelligenceAdapter,
  IntelligenceCoverage,
} from './types'
export { ROSTER_SNAPSHOT_SCHEMA_VERSION } from './types'

export { YAHOO_CAPABILITIES } from './yahoo'
export {
  SLEEPER_CAPABILITIES,
  toNormalizedSleeperLeague,
  sleeperIntelligenceAdapter,
  sleeperReadOwnedRoster,
  sleeperReadMatchup,
  sleeperReadAvailablePlayers,
  sleeperReadDraftMetadata,
} from './sleeper'
export {
  ESPN_CAPABILITIES,
  espnIntelligenceAdapter,
  espnReadOwnedRoster,
  espnReadMatchup,
  espnReadAvailablePlayers,
  espnReadDraftMetadata,
} from './espn'

// Packet 03, P3-5: yahoo has no PlatformIntelligenceAdapter yet — read
// access remains blocked pending real approval (see
// docs/yahoo-verification-checklist.md) — so this deliberately returns
// null rather than a fake adapter that would silently claim capabilities
// Yahoo doesn't have today. Callers (lib/rosterSnapshotSync.ts) treat a
// null adapter as 'approval_pending' for yahoo specifically.
export function getIntelligenceAdapter(platform: Platform): PlatformIntelligenceAdapter | null {
  if (platform === 'sleeper') return sleeperIntelligenceAdapter
  if (platform === 'espn') return espnIntelligenceAdapter
  return null
}
