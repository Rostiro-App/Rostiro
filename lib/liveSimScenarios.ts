// Dev-only Simulation Suite — LIVE tab scenarios (T-111 follow-up).
//
// Requested explicitly as data-driven, not hardcoded timed notifications:
// every scenario here seeds real rows (nfl_schedule, live_scores,
// live_matchup_points) and calls the REAL production functions
// (classifyDeltas, detectAndSendLiveUnlockPush) against that data — the
// same code path the real cron runs, not a shortcut that fakes the
// outcome directly. If the real pipeline has a bug, these scenarios will
// surface it, because they're exercising it, not bypassing it.
//
// Shares lib/simScenarios.ts's exact restore ledger (sim_state.restore_json)
// so one "Clear simulation" button cleans up both the original 4
// scenarios and these.

import { getSleeperRosters, getSleeperMatchups } from '@/lib/sleeper'
import { currentNflWeek } from '@/lib/liveMatchupPoints'
import { classifyDeltas, type ClassifiedLiveEvent } from '@/lib/liveEvents'
import { detectAndSendLiveUnlockPush } from '@/lib/windowRecap'
import { buildPulseItemsForUser, syncPulseItems } from '@/lib/pulse'
import {
  loadFounderLeagues,
  pickRealStarter,
  appendRestore,
  type AdminClient,
} from '@/lib/simScenarios'

async function seedLiveGame(
  admin: AdminClient,
  gameId: string,
  homeTeam: string,
  awayTeam: string,
  kickoffOffsetMinutes: number,
  statusState: 'pre' | 'in' | 'post'
): Promise<void> {
  const todayEt = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date())
  const kickoffAt = new Date(Date.now() + kickoffOffsetMinutes * 60_000)
  const gameTimeEt = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York', hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).format(kickoffAt)

  const { error: scheduleError } = await admin.from('nfl_schedule').upsert(
    { game_id: gameId, season: 2026, game_type: 'REG', week: 1, game_date: todayEt, game_time_et: gameTimeEt, home_team: homeTeam, away_team: awayTeam },
    { onConflict: 'game_id' }
  )
  if (scheduleError) throw new Error(`nfl_schedule seed failed: ${scheduleError.message}`)
  await appendRestore(admin, { table: 'nfl_schedule', match: { game_id: gameId }, delete: true })

  const { error: scoreError } = await admin.from('live_scores').upsert(
    { game_id: gameId, home_score: statusState === 'pre' ? 0 : 7, away_score: 0, period: statusState === 'pre' ? 0 : 1, display_clock: statusState === 'pre' ? '' : '10:00', status_state: statusState },
    { onConflict: 'game_id' }
  )
  if (scoreError) throw new Error(`live_scores seed failed: ${scoreError.message}`)
  await appendRestore(admin, { table: 'live_scores', match: { game_id: gameId }, delete: true })
}

async function seedMatchupPoints(
  admin: AdminClient,
  leagueId: string,
  week: number,
  rosterId: string,
  playersPoints: Record<string, number>
): Promise<void> {
  const { data: existing } = await admin
    .from('live_matchup_points')
    .select('players_points')
    .eq('league_id', leagueId)
    .eq('platform', 'sleeper')
    .eq('week', week)
    .eq('roster_id', rosterId)
    .maybeSingle()

  if (existing) {
    await appendRestore(admin, {
      table: 'live_matchup_points',
      match: { league_id: leagueId, platform: 'sleeper', week, roster_id: rosterId },
      column: 'players_points',
      value: existing.players_points,
    })
  } else {
    await appendRestore(admin, { table: 'live_matchup_points', match: { league_id: leagueId, platform: 'sleeper', week, roster_id: rosterId }, delete: true })
  }

  await admin.from('live_matchup_points').upsert(
    { league_id: leagueId, platform: 'sleeper', week, roster_id: rosterId, players_points: playersPoints, updated_at: new Date().toISOString() },
    { onConflict: 'league_id,platform,week,roster_id' }
  )
}

async function insertTrackedLiveEvent(admin: AdminClient, event: ClassifiedLiveEvent): Promise<void> {
  const { data, error } = await admin
    .from('live_events')
    .insert({ league_row_id: event.leagueRowId, platform: event.platform, player_id: event.playerId, event_type: event.eventType, delta: event.delta })
    .select('id')
    .single()
  if (error) throw new Error(`live_events insert failed: ${error.message}`)
  await appendRestore(admin, { table: 'live_events', match: { id: data.id }, delete: true })
}

// ─── Scenario: LIVE unlocks (real kickoff transition) ──────────────────────
// No forced_state — a real nfl_schedule row with kickoff_at = right now is
// what actually flips computeState() to game_day, the exact mechanism a
// real Sunday uses. Also fires the real detectAndSendLiveUnlockPush so the
// "LIVE is open" push gets exercised, not just described.
export async function runLiveUnlockScenario(admin: AdminClient): Promise<{ ok: boolean; note: string }> {
  const { leagues } = await loadFounderLeagues(admin)
  const league = leagues[0]
  if (!league) return { ok: false, note: 'No connected Sleeper league to attach this scenario to.' }

  const starter = await pickRealStarter(admin, league)
  if (!starter || !starter.nflTeam) return { ok: false, note: 'No real starter with a resolvable NFL team found on this roster.' }

  await seedLiveGame(admin, `SIM-UNLOCK-${league.id}`, starter.nflTeam, 'SIM', 0, 'in')

  const pushesSent = await detectAndSendLiveUnlockPush(admin).catch(() => 0)

  return {
    ok: true,
    note: `${starter.nflTeam} kickoff seeded right now — real computeState() should read this as Game Day within ~20s (the dock icon's own poll interval). Real "LIVE is open" push ${pushesSent > 0 ? 'sent.' : 'not sent (likely already sent today, or plan/subscription gated).'}`,
  }
}

// ─── Scenario: Touchdown (real classification) ─────────────────────────────
// Seeds a live game + a real live_matchup_points delta sized to the
// league's actual rushing/receiving TD value, then calls the REAL
// classifyDeltas — the same function the cron calls — so this proves the
// classifier reads it as a touchdown, not just asserts it.
export async function runTouchdownScenario(admin: AdminClient): Promise<{ ok: boolean; note: string }> {
  const { leagues } = await loadFounderLeagues(admin)
  const league = leagues[0]
  if (!league) return { ok: false, note: 'No connected Sleeper league to attach this scenario to.' }

  const starter = await pickRealStarter(admin, league)
  if (!starter || !starter.nflTeam) return { ok: false, note: 'No real starter with a resolvable NFL team found on this roster.' }

  const week = await currentNflWeek(admin)
  if (week === null) return { ok: false, note: 'Could not resolve a current NFL week.' }

  await seedLiveGame(admin, `SIM-TD-${league.id}`, starter.nflTeam, 'SIM', -10, 'in')

  const before = 8.4
  const after = before + 6.6 // a real rushing/receiving TD plus a little yardage, same shape a real jump takes
  await seedMatchupPoints(admin, league.league_id, week, league.team_id!, { [starter.playerId]: before })
  const classified = await classifyDeltas(admin, [{ leagueRowId: league.id, platform: 'sleeper', playerId: starter.playerId, prevPoints: before, newPoints: after }])
  if (classified.length === 0) return { ok: false, note: 'Real classifier did not return an event for this delta — check league scoring settings resolved correctly.' }

  await insertTrackedLiveEvent(admin, classified[0])
  await seedMatchupPoints(admin, league.league_id, week, league.team_id!, { [starter.playerId]: after })

  return { ok: true, note: `${starter.name} +${classified[0].delta.toFixed(1)} pts, classified as "${classified[0].eventType}" by the real classifier. Open /live to see the big-play takeover.` }
}

// ─── Scenario: Interception (negative event) ───────────────────────────────
export async function runInterceptionScenario(admin: AdminClient): Promise<{ ok: boolean; note: string }> {
  const { leagues } = await loadFounderLeagues(admin)
  const league = leagues[0]
  if (!league) return { ok: false, note: 'No connected Sleeper league to attach this scenario to.' }

  const rosters = await getSleeperRosters(league.league_id).catch(() => [])
  const myRoster = rosters.find((r) => String(r.roster_id) === league.team_id)
  const starterIds = (myRoster?.starters ?? []).filter((id: string) => id && id !== '0')
  const { data: qbRows } = starterIds.length
    ? await admin.from('players_cache').select('player_id, name, nfl_team').eq('platform', 'sleeper').eq('position', 'QB').in('player_id', starterIds)
    : { data: [] }
  const qb = (qbRows ?? [])[0] as { player_id: string; name: string; nfl_team: string | null } | undefined
  if (!qb?.nfl_team) return { ok: false, note: 'No real starting QB with a resolvable NFL team found on this roster.' }

  const week = await currentNflWeek(admin)
  if (week === null) return { ok: false, note: 'Could not resolve a current NFL week.' }

  await seedLiveGame(admin, `SIM-INT-${league.id}`, qb.nfl_team, 'SIM', -15, 'in')

  const before = 12.2
  await seedMatchupPoints(admin, league.league_id, week, league.team_id!, { [qb.player_id]: before })
  const classified = await classifyDeltas(admin, [{ leagueRowId: league.id, platform: 'sleeper', playerId: qb.player_id, prevPoints: before, newPoints: before - 1 }])
  if (classified.length === 0 || classified[0].eventType !== 'negative') {
    return { ok: false, note: 'Real classifier did not return a negative event — check the league\'s real interceptionThrownPoints value.' }
  }

  await insertTrackedLiveEvent(admin, classified[0])
  await seedMatchupPoints(admin, league.league_id, week, league.team_id!, { [qb.player_id]: before + classified[0].delta })

  return { ok: true, note: `${qb.name} ${classified[0].delta.toFixed(1)} pts, classified as "negative" by the real classifier — should render as a muted amber pulse on /live, never a red alarm.` }
}

// ─── Scenario: Lead change (real matchup swing) ────────────────────────────
// Seeds both rosters' live_matchup_points in the real matchup pairing
// (getSleeperMatchups' own matchup_id), flipping who's ahead — tests the
// matchup rail rendering a real score swing, not a hardcoded "you're
// winning" string.
//
// Also seeds a real live game for each side's chosen starter. Found while
// verifying this scenario in isolation: buildLiveRoster's own early-exit
// gate (no live_scores row with status_state 'in' -> return empty roster
// AND empty matchups) meant this scenario produced nothing at all on
// /live when nothing else had already made a game live — the matchup
// rail isn't independent of "is anyone actually playing," so this
// scenario needs to make that true itself, not assume another scenario
// already has.
export async function runLeadChangeScenario(admin: AdminClient): Promise<{ ok: boolean; note: string }> {
  const { leagues } = await loadFounderLeagues(admin)
  const league = leagues[0]
  if (!league) return { ok: false, note: 'No connected Sleeper league to attach this scenario to.' }

  const week = await currentNflWeek(admin)
  if (week === null) return { ok: false, note: 'Could not resolve a current NFL week.' }

  const matchups = await getSleeperMatchups(league.league_id, week).catch(() => [])
  const mine = matchups.find((m) => String(m.roster_id) === league.team_id)
  if (!mine || mine.matchup_id === null) return { ok: false, note: 'No real matchup found for this league this week.' }
  const opponent = matchups.find((m) => String(m.roster_id) !== league.team_id && m.matchup_id === mine.matchup_id)
  if (!opponent) return { ok: false, note: 'No real opponent roster found for this matchup.' }

  const rosters = await getSleeperRosters(league.league_id).catch(() => [])
  const myRoster = rosters.find((r) => String(r.roster_id) === league.team_id)
  const opponentRoster = rosters.find((r) => r.roster_id === opponent.roster_id)

  const myPlayer = await firstStarterWithTeam(admin, myRoster?.starters ?? [])
  const opponentPlayer = await firstStarterWithTeam(admin, opponentRoster?.starters ?? [])
  if (!myPlayer || !opponentPlayer) return { ok: false, note: 'Could not resolve a real starter with a known NFL team on one of the two rosters.' }

  await seedLiveGame(admin, `SIM-LEAD-A-${league.id}`, myPlayer.nflTeam, 'SIM', -20, 'in')
  await seedLiveGame(admin, `SIM-LEAD-B-${league.id}`, opponentPlayer.nflTeam, 'SIM', -25, 'in')

  // The matchup rail sums real starters' cached points (see liveRoster.ts) —
  // putting the whole target total on one real starter id each is enough
  // to prove the sum renders correctly; it doesn't need to be spread
  // realistically across the roster for this specific test.
  await seedMatchupPoints(admin, league.league_id, week, league.team_id!, { [myPlayer.playerId]: 68.2 })
  await seedMatchupPoints(admin, league.league_id, week, String(opponent.roster_id), { [opponentPlayer.playerId]: 61.4 })

  return { ok: true, note: `${league.league_name}: you now lead 68.2–61.4 (was trailing) — real starter points, summed by the real matchup rail logic, not a hardcoded string. Both starters' games seeded live. Open /live to see it.` }
}

async function firstStarterWithTeam(
  admin: AdminClient,
  starters: string[]
): Promise<{ playerId: string; nflTeam: string } | null> {
  const ids = starters.filter((id) => id && id !== '0')
  if (ids.length === 0) return null
  const { data: rows } = await admin.from('players_cache').select('player_id, nfl_team').eq('platform', 'sleeper').in('player_id', ids)
  const byId = new Map(((rows ?? []) as { player_id: string; nfl_team: string | null }[]).map((r) => [r.player_id, r.nfl_team]))
  for (const id of ids) {
    const nflTeam = byId.get(id)
    if (nflTeam) return { playerId: id, nflTeam }
  }
  return null
}

// ─── Scenario: Player injury, not live (digest strip only) ─────────────────
// Deliberately does NOT seed any live game — proves the injury shows in
// the "Player updates" digest, never as a live roster card, since the
// player isn't playing right now.
//
// Flipping players_cache.injury_status alone produces nothing visible —
// the real injury_alert pulse_item only gets created by
// buildPulseItemsForUser + syncPulseItems, which normally run on a cron.
// Waiting for that cron to happen to fire next isn't a real test, so this
// calls the exact same real functions synchronously, right here, the same
// way the cron does — the effect is then immediately visible in Player
// updates instead of "eventually, whenever the cron next runs."
export async function runNonLiveInjuryScenario(admin: AdminClient): Promise<{ ok: boolean; note: string }> {
  const { userId, leagues } = await loadFounderLeagues(admin)
  const league = leagues[0]
  if (!league) return { ok: false, note: 'No connected Sleeper league to attach this scenario to.' }

  const starter = await pickRealStarter(admin, league)
  if (!starter) return { ok: false, note: 'No real starter found on this roster.' }

  await appendRestore(admin, {
    table: 'players_cache',
    match: { player_id: starter.playerId, platform: 'sleeper' },
    column: 'injury_status',
    value: starter.injuryStatus,
  })
  await admin.from('players_cache').update({ injury_status: 'questionable' }).eq('player_id', starter.playerId).eq('platform', 'sleeper')

  const { items } = await buildPulseItemsForUser(admin, userId)
  await syncPulseItems(admin, userId, items)

  const fingerprint = `injury:${league.id}:${starter.playerId}:questionable`
  const { data: itemRow } = await admin.from('pulse_items').select('id').eq('user_id', userId).eq('fingerprint', fingerprint).maybeSingle()
  if (itemRow) await appendRestore(admin, { table: 'pulse_items', match: { id: itemRow.id }, delete: true })

  return {
    ok: itemRow ? true : false,
    note: itemRow
      ? `${starter.name} flagged questionable, real injury_alert pulse_item created (fingerprint ${fingerprint}) — no live game seeded, so it belongs in Player updates, never "Live now." Open /live or /pulse to see it now.`
      : `${starter.name} flagged questionable, but the real generator didn't produce an injury_alert for them — check whether they're actually a starter in this league or already had an open alert for a different status.`,
  }
}
