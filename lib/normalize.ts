// T-07: Normalize League and Roster from all 3 platforms into shared types.
// All feature code imports from types/index.ts — never from platform clients directly.
// This is the only file allowed to know about platform-specific response shapes.

import type {
  League,
  Roster,
  Player,
  ScoringSettings,
  RosterSlot,
  NFLPosition,
  InjuryStatus,
  Platform,
} from '@/types'

const SEASON = 2026

// ─── Sleeper normalization ─────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function normalizeSleeperLeague(raw: any, myRosterId: number): League {
  // T-111 bug found while verifying live event classification against a
  // real league: Sleeper puts every scoring value (pass_td, rec, rush_yd,
  // etc.) in its own top-level `scoring_settings` object, a sibling of
  // `settings` — not inside `settings` itself. Every field below was
  // silently reading from the wrong object and falling back to hardcoded
  // defaults for every real Sleeper league, never the league's actual
  // scoring. Confirmed directly: `scoring_settings.pass_int` is -1 on the
  // real connected league; `settings.pass_int` doesn't exist at all.
  const scoringSettings = raw.league?.scoring_settings ?? raw.scoring_settings ?? {}
  const scoring: ScoringSettings = {
    ppr: (scoringSettings.rec ?? 0) as 0 | 0.5 | 1,
    tePremium: scoringSettings.bonus_rec_te ?? 0,
    qbTouchdownPoints: scoringSettings.pass_td ?? 4,
    passingYardsPerPoint: scoringSettings.pass_yd ? 1 / scoringSettings.pass_yd : 1 / 25,
    rushingYardsPerPoint: scoringSettings.rush_yd ? 1 / scoringSettings.rush_yd : 1 / 10,
    receivingYardsPerPoint: scoringSettings.rec_yd ? 1 / scoringSettings.rec_yd : 1 / 10,
    isSuperFlex: (raw.league?.roster_positions ?? raw.roster_positions ?? []).includes('SUPER_FLEX'),
    isHalfPpr: (scoringSettings.rec ?? 0) === 0.5,
    rushTouchdownPoints: scoringSettings.rush_td ?? 6,
    receivingTouchdownPoints: scoringSettings.rec_td ?? 6,
    fumbleLostPoints: scoringSettings.fum_lost ?? -2,
    interceptionThrownPoints: scoringSettings.pass_int ?? -2,
  }

  const leagueId = raw.league?.league_id ?? raw.league_id
  const myRoster = (raw.rosters ?? []).find(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (r: any) => r.roster_id === myRosterId
  )
  const record = myRoster?.settings
    ? { wins: myRoster.settings.wins, losses: myRoster.settings.losses, ties: myRoster.settings.ties }
    : { wins: 0, losses: 0, ties: 0 }

  return {
    id: '', // filled in by API route after DB insert
    platform: 'sleeper',
    leagueId,
    leagueName: raw.league?.name ?? raw.name,
    season: SEASON,
    teamCount: raw.league?.total_rosters ?? raw.total_rosters,
    myTeamId: String(myRosterId),
    myTeamName: myRoster?.metadata?.team_name ?? `Team ${myRosterId}`,
    record,
    scoringSettings: scoring,
    rosterSlots: raw.league?.roster_positions ?? raw.roster_positions ?? [],
    currentMatchup: null, // populated separately
    lastSyncedAt: new Date().toISOString(),
    syncStatus: 'ok',
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function normalizeSleeperRoster(raw: any, leagueId: string): Roster {
  // Sleeper gives player IDs, not full player objects.
  // Full player data requires a separate lookup from players_cache.
  const starterIds: string[] = Array.isArray(raw.starters) ? raw.starters : []
  const allPlayerIds: string[] = Array.isArray(raw.players) ? raw.players : []
  const benchIds = allPlayerIds.filter((id) => !starterIds.includes(id))

  const toSlot = (id: string): RosterSlot => ({
    slotType: 'unknown',
    player: id ? stubPlayer(id, 'sleeper') : null,
  })

  return {
    leagueId,
    platform: 'sleeper',
    teamId: String(raw.roster_id),
    teamName: raw.metadata?.team_name ?? `Team ${raw.roster_id}`,
    season: SEASON,
    starters: starterIds.map(toSlot),
    bench: benchIds.map(toSlot),
    injuredReserve: [],
  }
}

// ─── Yahoo normalization ───────────────────────────────────────────────────────
// Yahoo returns XML-to-JSON. Shape varies — normalize aggressively.

// Packet 02: extracts league_keys from the /users;use_login=1/games/leagues
// collection response (getYahooLeagues). UNVERIFIED against a live
// authorized response — no real Yahoo account has completed OAuth yet (see
// Packet 02's completion report). Grounded in Yahoo's documented count-keyed
// collection pattern (fantasy_content.users.<n>.user[1].games.<n>.game[1]
// .leagues.<n>.league[0]) — the same numeric-string-key-or-array shape
// already confirmed live elsewhere in this file (normalizeYahooPlayers,
// normalizeYahooDraftResults) — not invented from nothing, but still not a
// substitute for a real captured fixture. Defensive against both the
// numeric-string-keyed object form and a plain array, same dual-handling
// already used for roster_positions below.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function extractYahooLeagueKeys(raw: any): string[] {
  const usersObj = raw?.fantasy_content?.users ?? {}
  const userEntries = collectionValues(usersObj)
  const keys: string[] = []

  for (const userEntry of userEntries) {
    const games = userEntry?.user?.[1]?.games ?? userEntry?.games ?? {}
    const gameEntries = collectionValues(games)
    for (const gameEntry of gameEntries) {
      const leagues = gameEntry?.game?.[1]?.leagues ?? gameEntry?.leagues ?? {}
      const leagueEntries = collectionValues(leagues)
      for (const leagueEntry of leagueEntries) {
        const leagueKey = leagueEntry?.league?.[0]?.league_key ?? leagueEntry?.league_key
        if (leagueKey) keys.push(leagueKey)
      }
    }
  }

  return keys
}

// Yahoo's "count" collections come back as an object keyed "0", "1", ...,
// "count" (not a JSON array) — this pulls just the numeric-keyed entries in
// order, tolerating a plain array too (some SDKs/proxies normalize it
// already). Shared by every collection-shaped Yahoo parser in this file.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function collectionValues(collection: unknown): any[] {
  if (Array.isArray(collection)) return collection
  if (collection && typeof collection === 'object') {
    return Object.entries(collection as Record<string, unknown>)
      .filter(([key]) => key !== 'count')
      .sort(([a], [b]) => Number(a) - Number(b))
      .map(([, value]) => value)
  }
  return []
}

// Packet 02: finds the team owned by the currently logged-in Yahoo user
// from a /league/{key}/teams response (getYahooLeagueTeams) — deliberately
// checks is_owned_by_current_login rather than assuming team index 0 (see
// getYahooLeagueTeams's own comment: that ordering assumption is
// unverified). UNVERIFIED against a live response — same caveat as
// extractYahooLeagueKeys above.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function extractYahooOwnedTeam(raw: any): { teamKey: string; teamName: string } | null {
  const teamsObj = raw?.fantasy_content?.league?.[1]?.teams ?? {}
  const teamEntries = collectionValues(teamsObj)

  for (const entry of teamEntries) {
    const teamMeta: unknown[] = entry?.team?.[0] ?? []
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const info: Record<string, any> = {}
    for (const item of teamMeta) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const i = item as any
      if (i?.team_key) info.teamKey = i.team_key
      if (i?.name) info.name = i.name
      if (i?.is_owned_by_current_login) info.isOwned = i.is_owned_by_current_login
    }
    if (info.isOwned && (info.isOwned === 1 || info.isOwned === '1')) {
      return { teamKey: info.teamKey ?? '', teamName: info.name ?? '' }
    }
  }

  return null
}

// Packet 02: draft status/timing from a league settings response. Field
// names (draft_status, draft_time as a unix-seconds string) per Yahoo's
// publicly documented league-settings resource — UNVERIFIED against a live
// authorized response.
export interface NormalizedYahooDraftInfo {
  status: 'not_started' | 'in_progress' | 'complete' | 'unknown'
  scheduledAt: string | null
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function parseYahooDraftInfo(settings: any): NormalizedYahooDraftInfo {
  const draftStatus: string | undefined = settings?.draft_status
  const status: NormalizedYahooDraftInfo['status'] =
    draftStatus === 'predraft' ? 'not_started'
    : draftStatus === 'drafting' ? 'in_progress'
    : draftStatus === 'postdraft' ? 'complete'
    : 'unknown'

  const draftTimeRaw = settings?.draft_time
  const draftTimeSeconds = draftTimeRaw != null ? Number(draftTimeRaw) : NaN
  const scheduledAt = Number.isFinite(draftTimeSeconds) && draftTimeSeconds > 0
    ? new Date(draftTimeSeconds * 1000).toISOString()
    : null

  return { status, scheduledAt }
}

// Packet 02: waiver settings from a league settings response. Field names
// (waiver_type: 'R'=rolling/'FR' or similar=FAAB per community-documented
// values, uses_faab, waiver_time as a day-count integer string) per Yahoo's
// publicly documented league-settings resource — UNVERIFIED against a live
// authorized response. waiver_time's exact semantics (day offset vs. a
// specific weekday) are NOT confirmed, so it's intentionally not mapped
// onto connected_leagues.waiver_cutoff_day/hour (a different, already-shipped
// feature — lib/rostiroState.ts's cutoff detection — that a wrong guess
// here could silently corrupt); it's only surfaced in the returned
// NormalizedLeague, not persisted to those specific columns.
export interface NormalizedYahooWaiverSettings {
  type: 'faab' | 'rolling' | 'reverse_standings' | 'unknown'
  faabBudget: number | null
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function parseYahooWaiverSettings(settings: any): NormalizedYahooWaiverSettings {
  const usesFaab = settings?.uses_faab === 1 || settings?.uses_faab === '1'
  if (usesFaab) {
    const budget = settings?.faab_balance ?? settings?.max_faab_bid
    return {
      type: 'faab',
      faabBudget: budget != null && Number.isFinite(Number(budget)) ? Number(budget) : null,
    }
  }

  const waiverType: string | undefined = settings?.waiver_type
  if (waiverType === 'R') return { type: 'rolling', faabBudget: null }
  if (waiverType === 'FR' || waiverType === 'BB') return { type: 'reverse_standings', faabBudget: null }
  return { type: 'unknown', faabBudget: null }
}

// Shared by normalizeYahooLeague and toNormalizedYahooLeague
// (lib/platforms/yahoo.ts) so both operate on the exact same settings
// object, not two independent (and potentially divergent) unwrappings of
// the same raw response.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function extractYahooSettings(raw: any): any {
  const lg = raw?.fantasy_content?.league?.[0] ?? raw?.league ?? raw
  return lg?.settings ?? {}
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function normalizeYahooLeague(raw: any): League {
  const lg = raw?.fantasy_content?.league?.[0] ?? raw?.league ?? raw

  const settings = extractYahooSettings(raw)
  const statCategories = settings?.stat_categories?.stats?.stat ?? []

  const getStat = (statId: number): number => {
    const stat = statCategories.find(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (s: any) => s?.stat?.stat_id === String(statId)
    )
    return parseFloat(stat?.stat?.value ?? '0')
  }

  const ppr = getStat(11) as 0 | 0.5 | 1 // stat 11 = receptions
  const tePremium = getStat(12) // stat 12 = TE reception bonus

  const scoring: ScoringSettings = {
    ppr,
    tePremium,
    qbTouchdownPoints: getStat(4) || 4,
    passingYardsPerPoint: getStat(9) ? 1 / getStat(9) : 1 / 25,
    rushingYardsPerPoint: getStat(10) ? 1 / getStat(10) : 1 / 10,
    receivingYardsPerPoint: getStat(11) ? 1 / getStat(11) : 1 / 10,
    isSuperFlex: false, // detect from roster positions
    isHalfPpr: ppr === 0.5,
    // T-111: NOT verified against a real connected Yahoo league (none
    // exists yet — same gap already true of this file's roster-position
    // parsing above). Standard-scoring defaults rather than a guessed
    // stat_id, so this degrades to a common real value instead of a wrong
    // one. Replace with real getStat() lookups once a real league exists
    // to verify the stat_ids against, same discipline already applied to
    // Sleeper/ESPN above.
    rushTouchdownPoints: 6,
    receivingTouchdownPoints: 6,
    fumbleLostPoints: -2,
    interceptionThrownPoints: -2,
  }

  const myTeam = lg?.teams?.team?.[0] ?? {}
  const teamRecord = myTeam?.team_standings?.outcome_totals ?? {}

  // roster_position is a simple repeating XML element, so Yahoo's JSON
  // conversion gives a plain array here (unlike the numeric-string-keyed
  // "count" object pattern used for countable resources like teams/players/
  // draft_results elsewhere in this file) — handle both defensively since
  // this is unverified against live Yahoo data.
  const rawRosterPositions = settings?.roster_positions?.roster_position ?? settings?.roster_positions ?? []
  const rosterPositionList = Array.isArray(rawRosterPositions)
    ? rawRosterPositions
    : Object.values(rawRosterPositions).filter((v): v is object => typeof v === 'object' && v !== null)
  const rosterSlots: string[] = []
  for (const entry of rosterPositionList) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rp = (entry as any)?.roster_position ?? entry
    const position = rp?.position
    const count = parseInt(rp?.count ?? '0', 10)
    if (!position || !count) continue
    for (let i = 0; i < count; i++) rosterSlots.push(position)
  }

  return {
    id: '',
    platform: 'yahoo',
    leagueId: lg?.league_key ?? '',
    leagueName: lg?.name ?? '',
    season: SEASON,
    teamCount: parseInt(lg?.num_teams ?? '10', 10),
    myTeamId: myTeam?.team_key ?? '',
    myTeamName: myTeam?.name ?? '',
    record: {
      wins: parseInt(teamRecord?.wins ?? '0', 10),
      losses: parseInt(teamRecord?.losses ?? '0', 10),
      ties: parseInt(teamRecord?.ties ?? '0', 10),
    },
    scoringSettings: scoring,
    rosterSlots,
    currentMatchup: null,
    lastSyncedAt: new Date().toISOString(),
    syncStatus: 'ok',
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function normalizeYahooRoster(raw: any, leagueId: string, teamKey: string): Roster {
  const players = raw?.fantasy_content?.team?.[1]?.roster?.['0']?.players ?? {}

  const slots: RosterSlot[] = Object.values(players)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .filter((p: any) => p?.player)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .map((p: any) => {
      const playerData = p.player[0] ?? []
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const info: Record<string, any> = {}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      playerData.forEach((item: any) => {
        if (item?.player_key) info.playerKey = item.player_key
        if (item?.name) info.name = item.name
        if (item?.editorial_team_abbr) info.team = item.editorial_team_abbr
        if (item?.primary_position) info.position = item.primary_position
        if (item?.status) info.injuryStatus = item.status
        if (item?.injury_note) info.injuryDesignation = item.injury_note
      })

      const selectedPosition = p.player[1]?.selected_position?.[1]?.position ?? 'BN'

      return {
        slotType: selectedPosition,
        player: {
          id: info.playerKey ?? '',
          name: `${info.name?.first ?? ''} ${info.name?.last ?? ''}`.trim(),
          firstName: info.name?.first ?? '',
          lastName: info.name?.last ?? '',
          position: (info.position as NFLPosition) ?? 'BN',
          nflTeam: info.team ?? '',
          platform: 'yahoo' as Platform,
          platformPlayerId: info.playerKey ?? '',
          injuryStatus: (info.injuryStatus as InjuryStatus) ?? null,
          injuryDesignation: info.injuryDesignation ?? null,
          adpConsensus: null,
          isOnBye: false,
          byeWeek: null,
          projectedPoints: null,
          ownership: null,
        },
      }
    })

  const starters = slots.filter((s) => s.slotType !== 'BN' && s.slotType !== 'IR')
  const bench = slots.filter((s) => s.slotType === 'BN')
  const ir = slots.filter((s) => s.slotType === 'IR')

  return {
    leagueId,
    platform: 'yahoo',
    teamId: teamKey,
    teamName: '',
    season: SEASON,
    starters,
    bench,
    injuredReserve: ir,
  }
}

// Batch player lookup — Yahoo's draft/results only gives player_key, no
// name, so Draft Copilot's picks route needs this to have a name/team to
// match against players_cache. Same fantasy_content.<n>.player[0] metadata
// traversal normalizeYahooRoster already uses per-roster-slot.
export interface YahooPlayerRaw {
  playerKey: string
  name: string
  team: string
  position: string
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function normalizeYahooPlayers(raw: any): YahooPlayerRaw[] {
  const playersObj = raw?.fantasy_content?.league?.[1]?.players ?? {}
  const count = Number(playersObj.count ?? 0)

  const results: YahooPlayerRaw[] = []
  for (let i = 0; i < count; i++) {
    const playerData = playersObj[String(i)]?.player?.[0] ?? []
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const info: Record<string, any> = {}
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    playerData.forEach((item: any) => {
      if (item?.player_key) info.playerKey = item.player_key
      if (item?.name) info.name = item.name
      if (item?.editorial_team_abbr) info.team = item.editorial_team_abbr
      if (item?.primary_position) info.position = item.primary_position
    })
    if (!info.playerKey) continue
    results.push({
      playerKey: info.playerKey,
      name: `${info.name?.first ?? ''} ${info.name?.last ?? ''}`.trim(),
      team: info.team ?? '',
      position: info.position ?? '',
    })
  }
  return results
}

// T-64.2: Draft Copilot — Yahoo draft results. Intermediate shape, not a full
// DraftPick — mirrors the Sleeper split where lib/sleeper.ts returns raw
// picks and the picks API route does the players_cache/player_mappings
// enrichment. Keeps both platforms structurally parallel.
export interface YahooDraftResultRaw {
  pickNumber: number
  round: number
  teamKey: string
  playerKey: string | null
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function normalizeYahooDraftResults(raw: any): YahooDraftResultRaw[] {
  const draftResults = raw?.fantasy_content?.league?.[1]?.draft_results ?? {}
  const count = Number(draftResults.count ?? 0)

  const results: YahooDraftResultRaw[] = []
  for (let i = 0; i < count; i++) {
    const entry = draftResults[String(i)]?.draft_result
    if (!entry) continue
    results.push({
      pickNumber: Number(entry.pick),
      round: Number(entry.round),
      teamKey: entry.team_key,
      playerKey: entry.player_key ?? null,
    })
  }
  return results
}

// ─── ESPN normalization ────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function normalizeEspnLeague(raw: any): League {
  const settings = raw?.settings ?? {}
  const scoringSettings = raw?.settings?.scoringSettings ?? {}

  const getScoringValue = (statId: number): number => {
    const item = scoringSettings?.scoringItems?.find(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (s: any) => s?.statId === statId
    )
    return item?.pointsOverrides?.['-1'] ?? item?.points ?? 0
  }

  const ppr = getScoringValue(53) as 0 | 0.5 | 1 // stat 53 = receptions

  const scoring: ScoringSettings = {
    ppr,
    tePremium: 0, // ESPN TE premium handled differently
    qbTouchdownPoints: getScoringValue(4) || 6,
    passingYardsPerPoint: getScoringValue(3) ? 1 / getScoringValue(3) : 1 / 25,
    rushingYardsPerPoint: getScoringValue(24) ? 1 / getScoringValue(24) : 1 / 10,
    receivingYardsPerPoint: getScoringValue(42) ? 1 / getScoringValue(42) : 1 / 10,
    isSuperFlex: false,
    isHalfPpr: ppr === 0.5,
    // T-111: confirmed live against real (statSourceId 0, not projected)
    // box scores from a real league — stat 25 appeared at clean 6-point
    // multiples matching real rushing TDs, 43 likewise for receiving TDs,
    // 72 at clean -2 multiples matching fumbles lost, 20 likewise for INTs
    // thrown. Cross-referenced against multiple real players/weeks, not a
    // single coincidental match.
    rushTouchdownPoints: getScoringValue(25) || 6,
    receivingTouchdownPoints: getScoringValue(43) || 6,
    fumbleLostPoints: getScoringValue(72) || -2,
    interceptionThrownPoints: getScoringValue(20) || -2,
  }

  const teams = raw?.teams ?? []
  const myTeam = teams[0] ?? {} // caller should filter to current user's team
  const record = myTeam?.record?.overall ?? { wins: 0, losses: 0, ties: 0 }

  return {
    id: '',
    platform: 'espn',
    leagueId: String(raw?.id ?? ''),
    leagueName: settings?.name ?? '',
    season: SEASON,
    teamCount: settings?.size ?? teams.length,
    myTeamId: String(myTeam?.id ?? ''),
    myTeamName: myTeam?.name ?? '',
    record: {
      wins: record.wins ?? 0,
      losses: record.losses ?? 0,
      ties: record.ties ?? 0,
    },
    scoringSettings: scoring,
    rosterSlots: [],
    currentMatchup: null,
    lastSyncedAt: new Date().toISOString(),
    syncStatus: 'ok',
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function normalizeEspnRoster(raw: any, leagueId: string, teamId: string): Roster {
  const teams = raw?.teams ?? []
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const team = teams.find((t: any) => String(t.id) === teamId) ?? teams[0] ?? {}
  const entries = team?.roster?.entries ?? []

  const ESPN_INJURY_MAP: Record<string, InjuryStatus> = {
    ACTIVE: 'active',
    QUESTIONABLE: 'questionable',
    DOUBTFUL: 'doubtful',
    OUT: 'out',
    IR: 'ir',
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const slots: RosterSlot[] = entries.map((entry: any) => {
    const playerPoolEntry = entry?.playerPoolEntry ?? {}
    const playerInfo = playerPoolEntry?.player ?? {}
    const injuryKey = playerPoolEntry?.lineupLockStatus ?? playerInfo?.injuryStatus ?? 'ACTIVE'

    return {
      slotType: String(entry?.lineupSlotId ?? ''),
      player: {
        id: String(playerInfo?.id ?? ''),
        name: playerInfo?.fullName ?? '',
        firstName: playerInfo?.firstName ?? '',
        lastName: playerInfo?.lastName ?? '',
        position: (playerInfo?.defaultPositionId as NFLPosition) ?? 'BN',
        nflTeam: playerInfo?.proTeam?.abbreviation ?? '',
        platform: 'espn' as Platform,
        platformPlayerId: String(playerInfo?.id ?? ''),
        injuryStatus: ESPN_INJURY_MAP[injuryKey] ?? 'active',
        injuryDesignation: playerPoolEntry?.injuryStatus ?? null,
        adpConsensus: null,
        isOnBye: playerPoolEntry?.onTeamByeWeek ?? false,
        byeWeek: playerInfo?.proTeam?.byeWeek ?? null,
        projectedPoints: entry?.playerPoolEntry?.projectedStats?.appliedTotal ?? null,
        ownership: playerPoolEntry?.percentOwned ?? null,
      },
    }
  })

  // ESPN slot IDs: 0=QB,2=RB,4=WR,6=TE,16=K,17=D/ST,20=BN,21=IR,23=FLEX
  const BENCH_SLOTS = ['20']
  const IR_SLOTS = ['21']

  const starters = slots.filter((s) => !BENCH_SLOTS.includes(s.slotType) && !IR_SLOTS.includes(s.slotType))
  const bench = slots.filter((s) => BENCH_SLOTS.includes(s.slotType))
  const ir = slots.filter((s) => IR_SLOTS.includes(s.slotType))

  return {
    leagueId,
    platform: 'espn',
    teamId,
    teamName: team?.name ?? '',
    season: SEASON,
    starters,
    bench,
    injuredReserve: ir,
  }
}

// ─── Stub player (used when only ID is available, e.g. Sleeper rosters) ───────

function stubPlayer(platformPlayerId: string, platform: Platform): Player {
  return {
    id: platformPlayerId,
    name: '',
    firstName: '',
    lastName: '',
    position: 'BN',
    nflTeam: '',
    platform,
    platformPlayerId,
    injuryStatus: null,
    injuryDesignation: null,
    adpConsensus: null,
    isOnBye: false,
    byeWeek: null,
    projectedPoints: null,
    ownership: null,
  }
}
