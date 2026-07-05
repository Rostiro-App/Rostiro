// Dev-only Simulation Suite — the four scenario payloads. Each one seeds
// real-shaped data against the founder's own real connected league/roster
// rather than a synthetic account, so the resulting cards look exactly like
// what a real user would eventually see.
//
// Deliberately NOT wired through the real background cron/detection loop
// (see lib/rostiroState.ts / app/api/system/status/route.ts for the
// display-only simNow() wiring) — these functions run once, on demand, from
// the admin route, and any fake schedule row they create is game_id-
// prefixed `SIM-` so it can never collide with real nflverse data.
//
// Every real row a scenario mutates or inserts is recorded into
// sim_state.restore_json as an explicit restore instruction — "clear
// simulation" replays these, so cleanup is exact rather than a fragile
// text-matching guess.
//
// Scenario 2 corrects a real platform limitation the original spec assumed
// away: live_scores (T-81) is team-level only, ESPN's scoreboard never
// names a specific scorer — so the simulated touchdown is genuinely
// team-level, exactly like the real detector, not a fabricated per-player
// attribution the product could never actually produce.

import { getSleeperRosters } from '@/lib/sleeper'
import { detectTouchdownSwings, type ScoreDelta } from '@/lib/engagementTriggers'
import { createAdminClient } from '@/lib/supabase'

export type AdminClient = ReturnType<typeof createAdminClient>

export interface ConnectedLeague {
  id: string
  league_id: string
  league_name: string
  team_id: string | null
}

export interface RealStarter {
  playerId: string
  name: string
  position: string | null
  nflTeam: string | null
  injuryStatus: string | null
}

export interface RestoreEntry {
  table: string
  match: Record<string, unknown>
  column?: string
  value?: unknown
  delete?: boolean
}

// Exported (T-111 follow-up) so lib/liveSimScenarios.ts's richer,
// data-driven scenarios share this exact same restore ledger — one
// "Clear simulation" button that actually cleans up everything, not two
// separate tracking systems.
export async function loadFounderLeagues(admin: AdminClient): Promise<{ userId: string; leagues: ConnectedLeague[] }> {
  const { data: founder } = await admin.from('users').select('id').eq('email', process.env.ADMIN_EMAIL).maybeSingle()
  if (!founder) throw new Error('Admin account not found — check ADMIN_EMAIL matches a real signed-up user')
  const { data: leagues } = await admin
    .from('connected_leagues')
    .select('id, league_id, league_name, team_id')
    .eq('user_id', founder.id)
    .eq('platform', 'sleeper')
  return { userId: founder.id as string, leagues: (leagues ?? []) as ConnectedLeague[] }
}

export async function pickRealStarter(admin: AdminClient, league: ConnectedLeague): Promise<RealStarter | null> {
  const rosters = await getSleeperRosters(league.league_id).catch(() => [])
  const myRoster = rosters.find((r) => String(r.roster_id) === league.team_id)
  const starterIds = (myRoster?.starters ?? []).filter((id: string) => id && id !== '0')
  if (starterIds.length === 0) return null

  const { data: rows } = await admin
    .from('players_cache')
    .select('player_id, name, position, nfl_team, injury_status')
    .eq('platform', 'sleeper')
    .in('player_id', starterIds)
  const starter = (rows ?? []).find((r: { nfl_team: string | null }) => r.nfl_team) as
    | { player_id: string; name: string; position: string | null; nfl_team: string | null; injury_status: string | null }
    | undefined
  if (!starter) return null

  return {
    playerId: starter.player_id,
    name: starter.name,
    position: starter.position,
    nflTeam: starter.nfl_team,
    injuryStatus: starter.injury_status,
  }
}

export async function appendRestore(admin: AdminClient, entry: RestoreEntry) {
  const { data } = await admin.from('sim_state').select('restore_json').eq('id', 1).maybeSingle()
  const existing: RestoreEntry[] = Array.isArray(data?.restore_json) ? data.restore_json : []
  await admin.from('sim_state').update({ restore_json: [...existing, entry] }).eq('id', 1)
}

export async function insertTrackedPulseItem(admin: AdminClient, row: Record<string, unknown>) {
  const { data, error } = await admin.from('pulse_items').insert(row).select('id').single()
  if (error) throw new Error(error.message)
  await appendRestore(admin, { table: 'pulse_items', match: { id: data.id }, delete: true })
}

// ─── Scenario 1: Pregame Lineup Panic Window ───────────────────────────────
export async function runScenario1(admin: AdminClient): Promise<{ ok: boolean; note: string }> {
  const { userId, leagues } = await loadFounderLeagues(admin)
  const league = leagues[0]
  if (!league) return { ok: false, note: 'No connected Sleeper league to attach this scenario to.' }

  const starter = await pickRealStarter(admin, league)
  if (!starter || !starter.nflTeam) return { ok: false, note: 'No real starter with a resolvable NFL team found on this roster.' }

  // Snapshot the real value before mutating it — "clear simulation" restores
  // this exact original, never a guessed default.
  await appendRestore(admin, {
    table: 'players_cache',
    match: { player_id: starter.playerId, platform: 'sleeper' },
    column: 'injury_status',
    value: starter.injuryStatus,
  })
  await admin.from('players_cache').update({ injury_status: 'doubtful' }).eq('player_id', starter.playerId).eq('platform', 'sleeper')

  const todayEt = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date())
  const kickoffAt = new Date(Date.now() + 4 * 60_000) // 4 real minutes out — inside SystemBar's <5min "red" ramp immediately
  // nfl_schedule.kickoff_at is a generated column (game_date + game_time_et)
  // — a direct write to it errors ("cannot insert a non-DEFAULT value").
  // Found live while verifying LIVE's roster builder: this same mistake
  // was silently failing this exact insert the whole time, which is why
  // "fake schedule rows: []" showed up during this scenario's own earlier
  // verification and wasn't caught then.
  const gameTimeEt = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York', hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).format(kickoffAt)
  const gameId = `SIM-LOCKWINDOW-${league.id}`
  const { error: scheduleError } = await admin.from('nfl_schedule').upsert(
    { game_id: gameId, season: 2026, game_type: 'REG', week: 1, game_date: todayEt, game_time_et: gameTimeEt, home_team: starter.nflTeam, away_team: 'SIM' },
    { onConflict: 'game_id' }
  )
  if (scheduleError) throw new Error(`nfl_schedule seed failed: ${scheduleError.message}`)
  await appendRestore(admin, { table: 'nfl_schedule', match: { game_id: gameId }, delete: true })

  const affectedLeagues = [{ leagueId: league.id, leagueName: league.league_name, platform: 'sleeper' }]
  await insertTrackedPulseItem(admin, {
    user_id: userId,
    type: 'injury_alert',
    priority: 'critical',
    headline: `${starter.name} — Doubtful`,
    reasoning: `${starter.name} is in your starting lineup and listed as doubtful. Check for a bench replacement before kickoff.`,
    affected_leagues_json: affectedLeagues,
    platform: 'sleeper',
    layer: 'action',
    status: 'open',
  })
  await insertTrackedPulseItem(admin, {
    user_id: userId,
    type: 'weather_alert',
    priority: 'important',
    headline: '31mph crosswinds forecast in Buffalo',
    reasoning: 'Sustained wind over 20mph historically suppresses passing volume and kicking accuracy — this type has no live generator yet (catalog phase 3); shown here to establish the intended shape.',
    affected_leagues_json: affectedLeagues,
    platform: 'sleeper',
    layer: 'action',
    status: 'open',
  })

  await admin.from('sim_state').update({ is_active: true, forced_state: 'game_day', active_scenario: '1' }).eq('id', 1)

  return { ok: true, note: `${starter.name} (${starter.nflTeam}) flipped to Doubtful, fake kickoff in 4 minutes, Game Day forced.` }
}

// ─── Scenario 2: Sunday Early Window Live Touchdown ────────────────────────
export async function runScenario2(admin: AdminClient): Promise<{ ok: boolean; note: string }> {
  const { userId, leagues } = await loadFounderLeagues(admin)
  const league = leagues[0]
  if (!league) return { ok: false, note: 'No connected Sleeper league to attach this scenario to.' }

  const starter = await pickRealStarter(admin, league)
  if (!starter || !starter.nflTeam) return { ok: false, note: 'No real starter with a resolvable NFL team found on this roster.' }

  // Calls the REAL detector with a synthetic delta — same team-level
  // attribution the real live_scores diff produces, never a specific
  // scoring player (T-81 has no play-by-play source). Uniquely-timestamped
  // gameId so re-running this scenario isn't silently deduped by
  // engagement_log's unique constraint, and so its dedupe_key is
  // reconstructable below for cleanup.
  const gameId = `SIM-TD-${league.id}-${Date.now()}`
  const delta: ScoreDelta = {
    gameId,
    homeTeam: starter.nflTeam,
    awayTeam: 'SIM',
    prevHomeScore: 0,
    prevAwayScore: 0,
    newHomeScore: 6,
    newAwayScore: 0,
  }
  await detectTouchdownSwings(admin, [delta])

  // detectTouchdownSwings writes its own engagement_log + pulse_items rows
  // directly (it has no "return what I created" contract — it's the real
  // production function, not a scenario helper) — reconstruct its own
  // dedupe key to find and register them for restore, so "Clear simulation"
  // actually removes what this run produced instead of leaving a real,
  // permanent trace of a simulated event.
  const dedupeKey = `${gameId}:6-0`
  const { data: logRow } = await admin
    .from('engagement_log')
    .select('id')
    .eq('user_id', userId)
    .eq('trigger_type', 'touchdown_swing')
    .eq('dedupe_key', dedupeKey)
    .maybeSingle()
  if (logRow) await appendRestore(admin, { table: 'engagement_log', match: { id: logRow.id }, delete: true })

  const { data: itemRow } = await admin
    .from('pulse_items')
    .select('id')
    .eq('user_id', userId)
    .eq('type', 'touchdown_swing')
    .ilike('headline', `${starter.nflTeam} scores%`)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (itemRow) await appendRestore(admin, { table: 'pulse_items', match: { id: itemRow.id }, delete: true })

  await admin.from('sim_state').update({ is_active: true, forced_state: 'game_day', active_scenario: '2' }).eq('id', 1)

  return {
    ok: true,
    note: `${starter.nflTeam} scored — real detectTouchdownSwings ran, routed to the Interrupt layer. If your account is on a paid plan and OneSignal's key is valid, this also sends a real push to your device.`,
  }
}

// ─── Scenario 3: Tuesday Waiver Briefing ───────────────────────────────────
export async function runScenario3(admin: AdminClient): Promise<{ ok: boolean; note: string }> {
  const { userId, leagues } = await loadFounderLeagues(admin)
  const league = leagues[0]
  if (!league) return { ok: false, note: 'No connected Sleeper league to attach this scenario to.' }

  // Same rosteredIds exclusion the real generator uses (lib/pulse.ts) — a
  // first pass of this scenario picked "Josh Allen is unrostered" by just
  // grabbing the single lowest-ADP cached player with no rostered check at
  // all, which is almost certainly false in any real league. Caught by
  // actually reading the verification output, not assumed correct.
  const rosters = await getSleeperRosters(league.league_id).catch(() => [])
  const rosteredIds = new Set(rosters.flatMap((r) => (Array.isArray(r.players) ? r.players : [])))

  const { data: pool } = await admin
    .from('players_cache')
    .select('player_id, name, position, adp_sleeper')
    .eq('platform', 'sleeper')
    .not('adp_sleeper', 'is', null)
    .order('adp_sleeper', { ascending: true })
    .limit(50)
  const bestWaiver = ((pool ?? []) as { player_id: string; name: string; position: string; adp_sleeper: number }[]).find(
    (p) => !rosteredIds.has(p.player_id)
  )
  if (!bestWaiver) return { ok: false, note: 'No genuinely unrostered player found in the top 50 cached by ADP.' }

  await insertTrackedPulseItem(admin, {
    user_id: userId,
    type: 'waiver_alert',
    priority: 'important',
    headline: `${bestWaiver.name} is unrostered`,
    reasoning: `${bestWaiver.name} (${bestWaiver.position}) has an ADP of ${Math.round(bestWaiver.adp_sleeper)}. You have $42 of your $100 FAAB budget left. Adding them projects to +6 on your League Health score.`,
    affected_leagues_json: [{ leagueId: league.id, leagueName: league.league_name, platform: 'sleeper' }],
    platform: 'sleeper',
    layer: 'action',
    status: 'open',
  })

  await admin.from('sim_state').update({ is_active: true, forced_state: 'waiver_day', active_scenario: '3' }).eq('id', 1)
  return { ok: true, note: `Waiver Day forced, real waiver_alert card inserted for ${bestWaiver.name}.` }
}

// ─── Scenario 4: Monday Night Film Room ────────────────────────────────────
// Reuses app/api/film-room/route.ts's existing DEMO_MODE path rather than
// inventing parallel fake usage-snapshot data — that path already exists
// for the identical reason (no league has a real completed week in July),
// now also gated to fire whenever forced_state is 'film_room', not just the
// local-only env var.
export async function runScenario4(admin: AdminClient): Promise<{ ok: boolean; note: string }> {
  await admin.from('sim_state').update({ is_active: true, forced_state: 'film_room', active_scenario: '4' }).eq('id', 1)
  return { ok: true, note: 'Film Room forced — /api/film-room now serves its existing demo recap path (real Claude call, illustrative score/usage data).' }
}

// ─── Clear ──────────────────────────────────────────────────────────────────
export async function clearSimulation(admin: AdminClient): Promise<void> {
  const { data } = await admin.from('sim_state').select('restore_json').eq('id', 1).maybeSingle()
  const restores: RestoreEntry[] = Array.isArray(data?.restore_json) ? data.restore_json : []

  // Replay in reverse (last inserted, first deleted). Restore entries are
  // appended in insert order, so a later entry can be a row with a foreign
  // key pointing at an earlier one (e.g. live_scores.game_id ->
  // nfl_schedule.game_id) — deleting in forward order hits a real FK
  // violation ("still referenced from table live_scores") that this loop
  // silently swallowed, leaving the parent row orphaned forever. Found by
  // adding explicit error logging around a delete that worked fine in
  // isolation but failed here specifically because of ordering.
  for (const r of [...restores].reverse()) {
    if (r.delete) {
      const { error } = await admin.from(r.table).delete().match(r.match)
      if (error) console.error(`clearSimulation: delete ${r.table} ${JSON.stringify(r.match)} failed:`, error.message)
    } else if (r.column) {
      const { error } = await admin.from(r.table).update({ [r.column]: r.value }).match(r.match)
      if (error) console.error(`clearSimulation: restore ${r.table}.${r.column} ${JSON.stringify(r.match)} failed:`, error.message)
    }
  }

  await admin.from('sim_state').update({
    is_active: false,
    sim_timestamp: null,
    forced_state: null,
    restore_json: [],
    active_scenario: null,
  }).eq('id', 1)
}
