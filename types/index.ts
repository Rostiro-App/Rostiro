// T-01: All shared TypeScript types for Rostiro OS
// Define here first — all lib files import from this module

// ─── Primitives ────────────────────────────────────────────────────────────────

export type Platform = 'espn' | 'yahoo' | 'sleeper'

// PRD 6.10 — computed by lib/rostiroState.ts, consumed by lib/brandTokens.ts
// and the system status API. Defined here (not in lib/rostiroState.ts) so it
// stays upstream of every lib file that needs it, per this file's own rule.
export type RostiroState = 'draft' | 'standard' | 'waiver_day' | 'game_day' | 'film_room'

export type UserPlan = 'free' | 'starter' | 'pro' | 'commissioner'

export type PulsePriority = 'critical' | 'important' | 'info'

export type PulseItemType =
  | 'lineup_decision'
  | 'injury_alert'
  | 'weather_alert'
  | 'waiver_alert'
  | 'trade_opportunity'
  | 'opponent_intel'
  | 'deadline_reminder'
  | 'exposure_flag'
  // T-93 / PRD 6.12 — the three Game Day engagement triggers buildable
  // against real data today (team-level score deltas + roster/schedule
  // data). Injury-during-play, live fantasy lead-change, trade-offer, and
  // Opportunity Surge all need data pipelines that don't exist yet.
  | 'touchdown_swing'
  | 'lineup_lock'
  | 'mission_complete'

export type DraftStatus = 'setup' | 'active' | 'complete'

export type AIQueryType = 'pulse' | 'start_sit' | 'trade' | 'draft_rec'

export type InjuryStatus = 'active' | 'questionable' | 'doubtful' | 'out' | 'ir' | null

export type NFLPosition = 'QB' | 'RB' | 'WR' | 'TE' | 'K' | 'DEF' | 'FLEX' | 'IDP' | 'BN'

export type GradeLetter = 'A+' | 'A' | 'A-' | 'B+' | 'B' | 'B-' | 'C+' | 'C' | 'C-' | 'D+' | 'D' | 'F'

export type Confidence = 'high' | 'medium' | 'low'

// ─── Player ────────────────────────────────────────────────────────────────────

export interface Player {
  id: string
  name: string
  firstName: string
  lastName: string
  position: NFLPosition
  nflTeam: string
  platform: Platform
  platformPlayerId: string
  injuryStatus: InjuryStatus
  injuryDesignation: string | null
  adpConsensus: number | null
  isOnBye: boolean
  byeWeek: number | null
  projectedPoints: number | null
  ownership: number | null // percentage owned in that platform
}

// ─── Roster ────────────────────────────────────────────────────────────────────

export interface RosterSlot {
  slotType: string
  player: Player | null
}

export interface Roster {
  leagueId: string
  platform: Platform
  teamId: string
  teamName: string
  season: number
  starters: RosterSlot[]
  bench: RosterSlot[]
  injuredReserve: RosterSlot[]
}

// ─── Scoring & League ──────────────────────────────────────────────────────────

export interface ScoringSettings {
  ppr: 0 | 0.5 | 1
  tePremium: number
  qbTouchdownPoints: number
  passingYardsPerPoint: number
  rushingYardsPerPoint: number
  receivingYardsPerPoint: number
  isSuperFlex: boolean
  isHalfPpr: boolean
}

export interface Matchup {
  weekNumber: number
  myProjectedScore: number
  opponentProjectedScore: number
  myActualScore: number
  opponentActualScore: number
  opponentTeamId: string
  opponentTeamName: string
  isComplete: boolean
}

export interface League {
  id: string // Rostiro internal ID (connected_leagues.id)
  platform: Platform
  leagueId: string // platform's league ID
  leagueName: string
  season: number
  teamCount: number
  myTeamId: string
  myTeamName: string
  record: { wins: number; losses: number; ties: number }
  scoringSettings: ScoringSettings
  rosterSlots: string[]
  currentMatchup: Matchup | null
  lastSyncedAt: string | null
  syncStatus: 'ok' | 'error' | 'pending' | null
}

// ─── Draft ─────────────────────────────────────────────────────────────────────

export interface DraftPick {
  pickNumber: number
  round: number
  pickInRound: number
  playerId: string
  playerName: string
  position: NFLPosition
  nflTeam: string
  pickedByTeamId: string
  isMyPick: boolean
  adpConsensus: number | null
  // positive = value (picked later than ADP), negative = reach (picked earlier)
  adpDelta: number | null
}

// A stated draft philosophy — see lib/draftBoard.ts for the round-by-round
// position weighting each one applies to Draft Copilot's rankings.
export type DraftStrategy = 'balanced' | 'zero_rb' | 'hero_rb' | 'hero_wr'

export interface DraftSettings {
  platform: Platform
  leagueId: string | null
  draftId: string | null
  teamCount: number
  myDraftPosition: number
  myRosterId: string | null // platform's internal roster/team ID — used to match picks to "isMyPick"
  totalRounds: number
  scoringSettings: ScoringSettings
  rosterSlots: string[]
  isSnakeDraft: boolean
  strategy: DraftStrategy
}

export interface DraftGrade {
  overall: GradeLetter
  verdict: string
  positionalGrades: Partial<Record<NFLPosition, GradeLetter>>
  bestValuePick: DraftPick | null
  biggestReach: DraftPick | null
  projectedWeek1Lineup: Player[]
  shareUrl: string | null
}

export interface DraftSession {
  id: string
  userId: string | null // null for anonymous Draft Kit sessions
  leagueId: string | null
  platform: Platform
  draftId: string | null
  status: DraftStatus
  settings: DraftSettings
  allPicks: DraftPick[]
  myPicks: DraftPick[]
  currentPickNumber: number
  myNextPickNumbers: number[]
  grade: DraftGrade | null
  createdAt: string
  updatedAt: string
}

// ─── ADP ───────────────────────────────────────────────────────────────────────

export interface ADPPlayer {
  playerId: string // FantasyPros/consensus ID
  name: string
  position: NFLPosition
  nflTeam: string
  adpConsensus: number
  adpEspn: number | null
  adpYahoo: number | null
  adpSleeper: number | null
  tier: number | null
  injuryStatus: InjuryStatus
  lastUpdated: string
}

// ─── Pulse ─────────────────────────────────────────────────────────────────────

export interface AffectedLeague {
  leagueId: string
  leagueName: string
  platform: Platform
}

// T-69: lifecycle state — Pulse items persist in the DB so acting on one
// (done/dismiss/snooze) survives regeneration instead of resurrecting daily.
export type PulseItemStatus = 'open' | 'done' | 'dismissed' | 'snoozed'

export interface PulseItem {
  id: string
  userId: string
  type: PulseItemType
  priority: PulsePriority
  headline: string
  reasoning: string
  affectedLeagues: AffectedLeague[]
  deadline: string | null
  actionUrl: string | null
  platform: Platform | null
  isDismissed: boolean
  status: PulseItemStatus
  createdAt: string
}

// ─── Weather ───────────────────────────────────────────────────────────────────

export interface StadiumWeather {
  stadiumId: string
  stadiumName: string
  city: string
  gameDate: string
  windSpeedMph: number
  precipitationChance: number // 0-100
  temperatureF: number
  isOutdoor: boolean
  alertTriggered: boolean // wind > 20mph or precip > 60%
  fetchedAt: string
}

// ─── AI / Claude ───────────────────────────────────────────────────────────────

export interface AIRecommendation {
  player: string
  playerId: string | null
  position: NFLPosition
  reasoning: string
  confidence: Confidence
  adpDelta: number | null
}

export interface DraftRecommendationResponse {
  recommendations: AIRecommendation[]
  alerts: Array<{
    type: 'steal' | 'reach' | 'positional_scarcity' | 'injury' | 'bye_week'
    playerName: string
    message: string
  }>
}

export interface StartSitRecommendation {
  leagueId: string
  leagueName: string
  platform: Platform
  playerA: Player
  playerB: Player
  verdict: 'start_a' | 'start_b' | 'lean_a' | 'lean_b' | 'toss_up'
  confidence: Confidence
  reasoning: string
}

export interface TradeAnalysis {
  verdict: 'win' | 'lose' | 'even'
  confidence: Confidence
  reasoning: string
  rosValueComparison: string
  rosterImpact: string
}

// ─── User ──────────────────────────────────────────────────────────────────────

export interface RostiroUser {
  id: string
  email: string
  plan: UserPlan
  trialEndsAt: string | null
  seasonPassExpiresAt: string | null
  stripeCustomerId: string | null
  stripeSubscriptionId: string | null
  intelligenceAddon: boolean
  pushEnabled: boolean
  createdAt: string
}

// ─── Cross-League Exposure ─────────────────────────────────────────────────────

export interface PlayerExposure {
  player: Player
  leaguesOwned: AffectedLeague[]
  exposurePercent: number // leagues owned / total leagues connected
  concentrationRisk: 'low' | 'medium' | 'high' // high = owned in 60%+ of leagues
  weatherAlert: StadiumWeather | null
  injuryAlert: boolean
}

// ─── OS Shell: League Health + System Status (PRD 6.2 / 6.7 W1-W2) ───────────

export type LeagueHealthStatus = 'healthy' | 'monitor' | 'action' | 'unknown'

export interface LeagueHealthFactor {
  key: 'injury' | 'bye' | 'waiver' | 'matchup' | 'depth'
  label: string
  weight: number // PRD 6.2 weights: 30/20/20/20/10
  score: number | null // null = data source not available yet (honest degradation)
  note: string | null // shown when score is null, e.g. "Loads Week 1"
}

export interface LeagueHealth {
  score: number | null // weighted average over available factors; null if none
  status: LeagueHealthStatus
  factors: LeagueHealthFactor[]
  topFlag: string | null // most actionable one-liner, e.g. "2 starters OUT"
}

export interface SystemStatusLeague {
  id: string // connected_leagues.id
  name: string
  platform: Platform
  health: LeagueHealth
}

export interface SystemDeadline {
  kind: 'draft' | 'waivers' | 'lineup_lock'
  label: string // e.g. "Draft"
  leagueName: string
  at: string // ISO timestamp
}

// T-90 / PRD 10.2: today's NFL games, read from the live_scores cache (T-81)
// joined against nfl_schedule — never fetched directly by a client. `rosterRelevant`
// is true when a player on one of the user's rosters is on either team, per 6.1's
// cross-league-relevance rule; Pulse/System Bar show only those, the bottom
// ticker shows all of them (its existing unfiltered, public-market character).
export interface RelevantPlayer {
  name: string
  leagueNames: string[]
}

export interface LiveGameScore {
  gameId: string
  homeTeam: string
  awayTeam: string
  homeScore: number
  awayScore: number
  period: number
  displayClock: string
  statusState: 'pre' | 'in' | 'post'
  kickoffAt: string
  rosterRelevant: boolean
  // UX Behavior Spec Gap #1: which of your players (and which leagues) made
  // this game roster-relevant — not gated behind Pro, since it's
  // personalization context, not the score itself (9's "depth is the
  // paywall" applies to the numbers, not to knowing why you should care).
  relevantPlayers: RelevantPlayer[]
}

export interface SystemStatus {
  syncedAt: string
  leagues: SystemStatusLeague[]
  nextDeadline: SystemDeadline | null
  rostiroState: RostiroState
  liveScores: LiveGameScore[]
  // PRD 6.1 / 9: free plan sees live scores blurred with an upgrade prompt;
  // Pro (and up) sees them unblurred. Computed server-side from users.plan
  // so the client never has to know the plan enum, just whether to blur.
  scoresGated: boolean
}

// ─── Error Classes ─────────────────────────────────────────────────────────────

export class AppError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number = 500
  ) {
    super(message)
    this.name = 'AppError'
    Object.setPrototypeOf(this, new.target.prototype)
  }
}

export class EspnAPIError extends AppError {
  constructor(message: string, code: string = 'ESPN_API_ERROR', statusCode: number = 500) {
    super(message, code, statusCode)
    this.name = 'EspnAPIError'
  }
}

export class YahooAPIError extends AppError {
  constructor(message: string, code: string = 'YAHOO_API_ERROR', statusCode: number = 500) {
    super(message, code, statusCode)
    this.name = 'YahooAPIError'
  }
}

export class SleeperAPIError extends AppError {
  constructor(message: string, code: string = 'SLEEPER_API_ERROR', statusCode: number = 500) {
    super(message, code, statusCode)
    this.name = 'SleeperAPIError'
  }
}

export class ClaudeAPIError extends AppError {
  constructor(message: string, code: string = 'CLAUDE_API_ERROR', statusCode: number = 500) {
    super(message, code, statusCode)
    this.name = 'ClaudeAPIError'
  }
}

export class EncryptionError extends AppError {
  constructor(message: string) {
    super(message, 'ENCRYPTION_ERROR', 500)
    this.name = 'EncryptionError'
  }
}
