// Packet 02: canonical cross-platform contract. Deliberately an
// intersection with types/index.ts's League, not a parallel type system —
// League (platform: Platform, leagueId, scoringSettings, rosterSlots,
// myTeamId/myTeamName, etc.) already is what every normalizeXLeague()
// function in lib/normalize.ts produces, and is already parametrized by
// the shared Platform union. This layer adds only what League doesn't
// carry yet: capability flags, draft/waiver metadata, league status, and
// data-quality warnings.

import type { League, Platform } from '@/types'
import type { PlayerIdentityConfidence } from '@/lib/playerIdentity'

export interface PlatformCapabilities {
  leagueRead: boolean
  rosterRead: boolean
  matchupRead: boolean
  draftRead: boolean
  freeAgentRead: boolean
  lineupWrite: boolean
  waiverWrite: boolean
  tradeWrite: boolean
}

export type NormalizedDraftStatus = 'not_started' | 'in_progress' | 'complete' | 'unknown'

export interface NormalizedDraftInfo {
  status: NormalizedDraftStatus
  scheduledAt: string | null // ISO timestamp, null if unknown/not scheduled
}

export type WaiverType = 'faab' | 'rolling' | 'reverse_standings' | 'unknown'

export interface NormalizedWaiverSettings {
  type: WaiverType
  faabBudget: number | null
  waiverDay: number | null // 0=Sunday..6=Saturday; platform-specific mapping lives in each platform's normalizer
  waiverHour: number | null
}

export type NormalizedLeagueStatus = 'active' | 'complete' | 'unknown'

export interface DataQualityWarning {
  field: string
  message: string
}

// The canonical league shape every platform import path should return.
// externalLeagueId/externalTeamId are League's existing leagueId/myTeamId
// fields — named again here in the doc comment, not duplicated, so a
// reader coming from the packet spec can find them: this type does NOT
// rename or translate a platform's raw ID into another platform's ID
// space (e.g. a Yahoo league_key is never coerced into looking like a
// Sleeper league_id) — leagueId always holds that platform's own raw,
// stable identifier.
export type NormalizedLeague = League & {
  leagueStatus: NormalizedLeagueStatus
  draft: NormalizedDraftInfo
  waiver: NormalizedWaiverSettings
  capabilities: PlatformCapabilities
  warnings: DataQualityWarning[]
}

// ─── Packet 03: roster/matchup/availability contract ────────────────────────
// Every shared intelligence consumer (Pulse, portfolio exposure, League
// Health, Player Intelligence) should read these shapes, never a raw
// per-platform response. identityConfidence/identityReason reuse
// lib/playerIdentity.ts's PlayerIdentityResolution vocabulary verbatim —
// this is NOT a parallel identity system, it's the same resolver's output
// carried through into the roster contract.

export const ROSTER_SNAPSHOT_SCHEMA_VERSION = 1 as const

export type LineupStatus = 'starting' | 'bench' | 'ir' | 'taxi' | 'unknown'

export interface NormalizedRosterPlayer {
  canonicalPlayerId: string | null
  sourcePlatform: Platform
  sourcePlayerId: string
  displayName: string
  nflTeam: string | null
  position: string | null
  lineupStatus: LineupStatus
  slot: string | null
  identityConfidence: PlayerIdentityConfidence
  identityReason: string
}

export interface NormalizedRosterSnapshot {
  schemaVersion: typeof ROSTER_SNAPSHOT_SCHEMA_VERSION
  connectedLeagueId: string
  platform: Platform
  externalLeagueId: string
  externalTeamId: string
  capturedAt: string
  providerUpdatedAt: string | null
  players: NormalizedRosterPlayer[]
  warnings: DataQualityWarning[]
}

export type MatchupStatus = 'pregame' | 'live' | 'final' | 'unknown'

export interface NormalizedMatchup {
  connectedLeagueId: string
  platform: Platform
  week: number
  myTeamId: string
  opponentTeamId: string | null
  myScore: number | null
  opponentScore: number | null
  myProjectedScore: number | null
  opponentProjectedScore: number | null
  status: MatchupStatus
  capturedAt: string
  warnings: DataQualityWarning[]
}

// A player NOT on the caller's own roster — the free-agent/waiver pool for
// a league. Never inferred from "absent from my roster"; only ever
// produced by a real provider read of the league's actual pool (or
// reported 'unconfirmed' when the provider can't supply one).
export type AvailabilityState = 'free_agent' | 'waivers' | 'unconfirmed'

export interface NormalizedAvailablePlayer {
  canonicalPlayerId: string | null
  sourcePlatform: Platform
  sourcePlayerId: string
  displayName: string
  nflTeam: string | null
  position: string | null
  availability: AvailabilityState
  identityConfidence: PlayerIdentityConfidence
}

// ─── Packet 03: read-result envelope ─────────────────────────────────────────
// Distinguishes "supported and returned," "supported but temporarily
// failed," "unsupported by this provider/integration," "blocked pending
// external approval" (Yahoo today), and "unverified — no real fixture
// exists yet to trust this parser." A capability flag alone can't carry
// this — capabilities are static per-platform declarations, this is the
// per-call outcome.
export type IntelligenceReadStatus = 'ok' | 'failed' | 'unsupported' | 'approval_pending' | 'unverified'

export interface IntelligenceReadResult<T> {
  status: IntelligenceReadStatus
  data: T | null
  warnings: DataQualityWarning[]
  // Safe, non-credential, non-raw-response message — set only when
  // status is 'failed'. Never include tokens, cookies, or provider
  // response bodies here (see lib/yahoo.ts's YahooAPIError precedent).
  errorReason?: string
}

// ─── Packet 03: named freshness states (Section 7) ───────────────────────────
// 'fresh' / 'stale' distinguish successful-but-aging data from a genuine
// failure; 'unavailable' means no successful snapshot has ever been
// captured; 'unsupported'/'approval_pending' mirror IntelligenceReadStatus
// for the same reasons a live read might not be possible.
export type SnapshotFreshness = 'fresh' | 'stale' | 'unavailable' | 'unsupported' | 'approval_pending'

// ─── Packet 03: narrow provider read adapter (Workstream B) ─────────────────
// Server-only when a real implementation requires credentials (ESPN
// cookies, Yahoo OAuth tokens) — this interface itself is just types, safe
// to import anywhere; concrete adapters (lib/platforms/sleeper.ts et al.)
// are the server-only boundary, same as lib/yahoo.ts/lib/espn.ts today.
export interface ConnectedLeagueContext {
  connectedLeagueId: string
  userId: string
  platform: Platform
  externalLeagueId: string
  externalTeamId: string
}

export interface PlatformIntelligenceAdapter {
  platform: Platform
  capabilities: PlatformCapabilities
  readOwnedRoster(context: ConnectedLeagueContext): Promise<IntelligenceReadResult<NormalizedRosterSnapshot>>
  readMatchup?(context: ConnectedLeagueContext, week: number): Promise<IntelligenceReadResult<NormalizedMatchup>>
  readAvailablePlayers?(context: ConnectedLeagueContext): Promise<IntelligenceReadResult<NormalizedAvailablePlayer[]>>
  readDraftMetadata?(context: ConnectedLeagueContext): Promise<IntelligenceReadResult<NormalizedDraftInfo>>
}

// ─── Packet 03: coverage summary (Section 13) ────────────────────────────────
// So a consumer (and the UI, eventually Packet 04) can tell "nothing needs
// attention" apart from "Rostiro could not inspect two of your leagues."
export interface IntelligenceCoverage {
  totalConnectedLeagues: number
  freshLeagues: number
  staleLeagues: number
  unavailableLeagues: number
  unresolvedPlayerCount: number
  byPlatform: Record<Platform, {
    connected: number
    included: number
    stale: number
    failed: number
    unsupported: number
  }>
}
