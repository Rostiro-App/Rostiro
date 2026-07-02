// T-01: All shared TypeScript types for Rostiro OS
// Define here first — all lib files import from this module

// ─── Primitives ────────────────────────────────────────────────────────────────

export type Platform = 'espn' | 'yahoo' | 'sleeper'

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
