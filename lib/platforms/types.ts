// Packet 02: canonical cross-platform contract. Deliberately an
// intersection with types/index.ts's League, not a parallel type system —
// League (platform: Platform, leagueId, scoringSettings, rosterSlots,
// myTeamId/myTeamName, etc.) already is what every normalizeXLeague()
// function in lib/normalize.ts produces, and is already parametrized by
// the shared Platform union. This layer adds only what League doesn't
// carry yet: capability flags, draft/waiver metadata, league status, and
// data-quality warnings.

import type { League } from '@/types'

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
