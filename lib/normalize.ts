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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function normalizeYahooLeague(raw: any): League {
  const lg = raw?.fantasy_content?.league?.[0] ?? raw?.league ?? raw

  const settings = lg?.settings ?? {}
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
