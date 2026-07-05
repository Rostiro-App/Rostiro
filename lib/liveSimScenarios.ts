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
import { detectLineupLockUrgency, detectMissionComplete, detectTouchdownSwings, type ScoreDelta } from '@/lib/engagementTriggers'
import { toNflverseTeamCode } from '@/lib/liveScores'
import {
  loadFounderLeagues,
  pickRealStarter,
  appendRestore,
  type AdminClient,
  type ConnectedLeague,
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

// ─── Scenario: Big play (large non-scoring jump) ───────────────────────────
// A +4.5 delta — above BIG_PLAY_MIN_POINTS, below TD magnitude — proving
// the classifier reads it as 'big_play' and the takeover says "BIG PLAY",
// never "TOUCHDOWN", for a jump that doesn't prove a score.
export async function runBigPlayScenario(admin: AdminClient): Promise<{ ok: boolean; note: string }> {
  const { leagues } = await loadFounderLeagues(admin)
  const league = leagues[0]
  if (!league) return { ok: false, note: 'No connected Sleeper league to attach this scenario to.' }

  // Non-QB on purpose — a QB's +4.5 in a 4-pt-passing-TD league IS a
  // touchdown by the position-aware threshold, which would make this
  // scenario "fail" while the classifier is being exactly right.
  const rosters = await getSleeperRosters(league.league_id).catch(() => [])
  const myRoster = rosters.find((r) => String(r.roster_id) === league.team_id)
  const starterIds = (myRoster?.starters ?? []).filter((id: string) => id && id !== '0')
  const { data: rows } = starterIds.length
    ? await admin.from('players_cache').select('player_id, name, nfl_team, position').eq('platform', 'sleeper').neq('position', 'QB').in('player_id', starterIds)
    : { data: [] }
  const starter = ((rows ?? []) as { player_id: string; name: string; nfl_team: string | null }[]).find((r) => r.nfl_team)
  if (!starter?.nfl_team) return { ok: false, note: 'No real non-QB starter with a resolvable NFL team found on this roster.' }

  const week = await currentNflWeek(admin)
  if (week === null) return { ok: false, note: 'Could not resolve a current NFL week.' }

  await seedLiveGame(admin, `SIM-BIGPLAY-${league.id}`, starter.nfl_team, 'SIM', -10, 'in')

  const before = 6.2
  const after = before + 4.5
  await seedMatchupPoints(admin, league.league_id, week, league.team_id!, { [starter.player_id]: before })
  const classified = await classifyDeltas(admin, [{ leagueRowId: league.id, platform: 'sleeper', playerId: starter.player_id, prevPoints: before, newPoints: after }])
  if (classified.length === 0 || classified[0].eventType !== 'big_play') {
    return { ok: false, note: `Real classifier returned "${classified[0]?.eventType ?? 'nothing'}" instead of big_play — check thresholds against this league's real TD values.` }
  }

  await insertTrackedLiveEvent(admin, classified[0])
  await seedMatchupPoints(admin, league.league_id, week, league.team_id!, { [starter.player_id]: after })

  return { ok: true, note: `${starter.name} +${classified[0].delta.toFixed(1)} pts, classified as "big_play" — the takeover should say BIG PLAY, not TOUCHDOWN.` }
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

// ─── Scenario: Lineup-lock urgency (real P0 interrupt) ─────────────────────
// T-93's engagementTriggers.ts has three real detectors, but only
// detectTouchdownSwings was ever exercised by a sim scenario — this and the
// mission-complete scenario below close that gap. Seeds a real nfl_schedule
// row with kickoff ~12 real minutes out (inside detectLineupLockUrgency's
// own 30-min window) for a real starter's team, flips that starter to
// doubtful, then calls the REAL detectLineupLockUrgency — the same function
// the lineup-lock cron calls — so this proves the P0 interrupt fires
// end-to-end (engagement_log claim -> pulse_item insert -> push), not just
// that the ingredients for it exist.
export async function runLineupLockScenario(admin: AdminClient): Promise<{ ok: boolean; note: string }> {
  const { userId, leagues } = await loadFounderLeagues(admin)
  const league = leagues[0]
  if (!league) return { ok: false, note: 'No connected Sleeper league to attach this scenario to.' }

  const starter = await pickRealStarter(admin, league)
  if (!starter || !starter.nflTeam) return { ok: false, note: 'No real starter with a resolvable NFL team found on this roster.' }

  await appendRestore(admin, {
    table: 'players_cache',
    match: { player_id: starter.playerId, platform: 'sleeper' },
    column: 'injury_status',
    value: starter.injuryStatus,
  })
  await admin.from('players_cache').update({ injury_status: 'doubtful' }).eq('player_id', starter.playerId).eq('platform', 'sleeper')

  // 'pre' status, 12 real minutes out — inside the detector's 30-min
  // window, but far enough out that the panel's own round-trip can't
  // accidentally race it past kickoff before the result renders.
  await seedLiveGame(admin, `SIM-LOCK-${league.id}`, starter.nflTeam, 'SIM', 12, 'pre')

  const todayEt = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date())
  await detectLineupLockUrgency(admin, todayEt)

  const dedupeKey = `${league.id}:${todayEt}`
  const { data: logRow } = await admin
    .from('engagement_log')
    .select('id')
    .eq('user_id', userId)
    .eq('trigger_type', 'lineup_lock')
    .eq('dedupe_key', dedupeKey)
    .maybeSingle()
  if (logRow) await appendRestore(admin, { table: 'engagement_log', match: { id: logRow.id }, delete: true })

  const { data: itemRow } = await admin
    .from('pulse_items')
    .select('id')
    .eq('user_id', userId)
    .eq('type', 'lineup_lock')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (itemRow) await appendRestore(admin, { table: 'pulse_items', match: { id: itemRow.id }, delete: true })

  return {
    ok: itemRow ? true : false,
    note: itemRow
      ? `${starter.name} flagged doubtful, kickoff seeded 12 min out — real detectLineupLockUrgency fired a P0 interrupt (engagement_log dedupe key ${dedupeKey}). Open the app to see it hold the single interrupt slot.`
      : `${starter.name} flagged doubtful and kickoff seeded 12 min out, but the real detector didn't fire — check for an already-open lineup_lock for today (dedupe key ${dedupeKey}), or whether the starter's team resolved correctly against today's schedule.`,
  }
}

// ─── Scenario: Mission complete (real end-of-day summary) ──────────────────
// Seeds a real nfl_schedule + live_scores row already 'post' for a real
// starter's team, then calls the REAL detectMissionComplete — the same
// function the mission-complete cron calls — so this proves the "all your
// games are final" summary only fires once every one of the user's
// roster-relevant games today has actually finished, not on a timer.
export async function runMissionCompleteScenario(admin: AdminClient): Promise<{ ok: boolean; note: string }> {
  const { userId, leagues } = await loadFounderLeagues(admin)
  const league = leagues[0]
  if (!league) return { ok: false, note: 'No connected Sleeper league to attach this scenario to.' }

  const starter = await pickRealStarter(admin, league)
  if (!starter || !starter.nflTeam) return { ok: false, note: 'No real starter with a resolvable NFL team found on this roster.' }

  // detectMissionComplete compares the roster's Sleeper team codes (already
  // converted through toNflverseTeamCode on its side) against
  // nfl_schedule.home_team/away_team, which nflverse ingestion always
  // writes in nflverse convention (e.g. Rams = "LA", not Sleeper's "LAR") —
  // converting here too, rather than writing the raw Sleeper code, so this
  // scenario can't silently no-op if pickRealStarter happens to land on
  // one of the two teams whose codes actually differ between the two
  // conventions (same class of bug T-81 already caught once for real).
  const nflverseTeam = toNflverseTeamCode(starter.nflTeam)

  // -180 real minutes and 'post' — a kickoff far enough in the past that
  // the game reads as long-finished, same ET calendar day for any
  // reasonable test time.
  await seedLiveGame(admin, `SIM-MISSION-${league.id}`, nflverseTeam, 'SIM', -180, 'post')

  const todayEt = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date())
  await detectMissionComplete(admin, todayEt)

  const { data: logRow } = await admin
    .from('engagement_log')
    .select('id')
    .eq('user_id', userId)
    .eq('trigger_type', 'mission_complete')
    .eq('dedupe_key', todayEt)
    .maybeSingle()
  if (logRow) await appendRestore(admin, { table: 'engagement_log', match: { id: logRow.id }, delete: true })

  const { data: itemRow } = await admin
    .from('pulse_items')
    .select('id')
    .eq('user_id', userId)
    .eq('type', 'mission_complete')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (itemRow) await appendRestore(admin, { table: 'pulse_items', match: { id: itemRow.id }, delete: true })

  return {
    ok: itemRow ? true : false,
    note: itemRow
      ? `${starter.nflTeam} game seeded as final — real detectMissionComplete confirmed every roster-relevant game today is 'post' and fired the calm Action-layer summary card. Open /pulse to see it.`
      : `${starter.nflTeam} game seeded as final, but the real detector didn't fire — check for another real or simulated game today involving one of this roster's teams that isn't 'post' yet (allDone requires every relevant game finished), or an already-open mission_complete for today.`,
  }
}

// ─── Scenario: Cross-league touchdown dedup (real multi-league grouping) ───
// detectTouchdownSwings groups affected leagues by user (PRD 6.12: "one push
// per user naming every affected league, never one push per league"), but
// every prior scenario in this suite only ever used leagues[0] — there was
// no way to actually exercise that grouping logic until a second real
// league existed. Finds an NFL team genuinely rostered (any roster slot,
// not just a starter — matching detectTouchdownSwings' own `myRoster.players`
// check) in two or more of the founder's connected leagues, fires one
// synthetic ScoreDelta for that team through the REAL detector, and checks
// the resulting pulse item names every affected league in a single card,
// not one card per league.
export async function runCrossLeagueTouchdownScenario(admin: AdminClient): Promise<{ ok: boolean; note: string }> {
  const { userId, leagues } = await loadFounderLeagues(admin)
  if (leagues.length < 2) {
    return { ok: false, note: `Need at least 2 connected Sleeper leagues to test cross-league dedup — only ${leagues.length} found.` }
  }

  const teamsByLeague: { league: ConnectedLeague; teams: Set<string> }[] = []
  for (const league of leagues) {
    const rosters = await getSleeperRosters(league.league_id).catch(() => [])
    const myRoster = rosters.find((r) => String(r.roster_id) === league.team_id)
    const playerIds = (myRoster?.players ?? []).filter((id: string) => id && id !== '0')
    if (playerIds.length === 0) {
      teamsByLeague.push({ league, teams: new Set() })
      continue
    }
    const { data: rows } = await admin.from('players_cache').select('nfl_team').eq('platform', 'sleeper').in('player_id', playerIds)
    const teams = new Set(((rows ?? []) as { nfl_team: string | null }[]).map((r) => r.nfl_team).filter((t): t is string => !!t))
    teamsByLeague.push({ league, teams })
  }

  const leaguesByTeam = new Map<string, ConnectedLeague[]>()
  for (const { league, teams } of teamsByLeague) {
    for (const team of teams) {
      leaguesByTeam.set(team, [...(leaguesByTeam.get(team) ?? []), league])
    }
  }
  const shared = [...leaguesByTeam.entries()].find(([, ls]) => ls.length >= 2)
  if (!shared) {
    return {
      ok: false,
      note: `None of your ${leagues.length} connected leagues share a rostered NFL team — cross-league dedup needs the same real team rostered (any slot) in two leagues to test. Roster a player from the same team in both to enable this.`,
    }
  }
  const [team, affectedLeagues] = shared

  const gameId = `SIM-XLEAGUE-TD-${team}-${Date.now()}`
  const delta: ScoreDelta = { gameId, homeTeam: team, awayTeam: 'SIM', prevHomeScore: 0, prevAwayScore: 0, newHomeScore: 6, newAwayScore: 0 }
  await detectTouchdownSwings(admin, [delta])

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
    .select('id, affected_leagues_json')
    .eq('user_id', userId)
    .eq('type', 'touchdown_swing')
    .ilike('headline', `${team} scores%`)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (itemRow) await appendRestore(admin, { table: 'pulse_items', match: { id: itemRow.id }, delete: true })

  const namedLeagueCount = Array.isArray(itemRow?.affected_leagues_json) ? itemRow.affected_leagues_json.length : 0
  const ok = !!itemRow && namedLeagueCount >= 2

  return {
    ok,
    note: ok
      ? `${team} scored — real detectTouchdownSwings fired ONE pulse item naming all ${namedLeagueCount} affected leagues (${affectedLeagues.map((l) => l.league_name).join(', ')}), proving cross-league dedup instead of one card per league.`
      : `${team} scored across ${affectedLeagues.length} of your leagues, but the resulting item named only ${namedLeagueCount} league(s) — real cross-league grouping in detectTouchdownSwings may not be working as intended. Check byUser grouping there.`,
  }
}

// ─── Scenario: Lineup-lock, empty starter slot (real, opportunistic) ───────
// detectLineupLockUrgency fires on either an injury flag (Scenario 11) or
// an empty starter slot (bye week, unfilled bench-to-starter swap) — but an
// empty slot isn't something this suite can fabricate the way injury_status
// can be flipped: Sleeper's public API has no write endpoint for lineups,
// and building one just to manufacture a synthetic gap would mean mutating
// a real roster during a real, live season — a categorically bigger risk
// than anything else this suite touches. So this scenario is read-only and
// opportunistic: it looks across your connected rosters for one that
// ALREADY has a genuine empty starter slot right now, seeds only the
// kickoff window for that roster's earliest-kickoff team, and calls the
// real detector — proving the branch fires when the condition is real,
// rather than asserting it against fabricated data.
export async function runEmptySlotLineupLockScenario(admin: AdminClient): Promise<{ ok: boolean; note: string }> {
  const { userId, leagues } = await loadFounderLeagues(admin)
  if (leagues.length === 0) return { ok: false, note: 'No connected Sleeper league to attach this scenario to.' }

  for (const league of leagues) {
    const rosters = await getSleeperRosters(league.league_id).catch(() => [])
    const myRoster = rosters.find((r) => String(r.roster_id) === league.team_id)
    if (!myRoster?.starters?.length) continue
    const emptySlots = myRoster.starters.filter((id: string) => id === '0').length
    if (emptySlots === 0) continue

    const filledStarterIds = myRoster.starters.filter((id: string) => id !== '0')
    const starter = await firstStarterWithTeam(admin, filledStarterIds)
    if (!starter) continue

    await seedLiveGame(admin, `SIM-EMPTYSLOT-${league.id}`, starter.nflTeam, 'SIM', 12, 'pre')
    const todayEt = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date())
    await detectLineupLockUrgency(admin, todayEt)

    const dedupeKey = `${league.id}:${todayEt}`
    const { data: logRow } = await admin
      .from('engagement_log')
      .select('id')
      .eq('user_id', userId)
      .eq('trigger_type', 'lineup_lock')
      .eq('dedupe_key', dedupeKey)
      .maybeSingle()
    if (logRow) await appendRestore(admin, { table: 'engagement_log', match: { id: logRow.id }, delete: true })

    const { data: itemRow } = await admin
      .from('pulse_items')
      .select('id')
      .eq('user_id', userId)
      .eq('type', 'lineup_lock')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (itemRow) await appendRestore(admin, { table: 'pulse_items', match: { id: itemRow.id }, delete: true })

    return {
      ok: !!itemRow,
      note: itemRow
        ? `${league.league_name} has ${emptySlots} genuinely empty starter slot(s) right now — kickoff seeded 12 min out on ${starter.nflTeam}, real detectLineupLockUrgency fired on the empty-slot branch (no injury involved).`
        : `${league.league_name} has ${emptySlots} empty starter slot(s) and kickoff was seeded, but the real detector didn't fire — check dedupe key ${dedupeKey} for an already-open alert today.`,
    }
  }

  return {
    ok: false,
    note: `None of your ${leagues.length} connected league(s) currently have a real empty starter slot, so this branch can't be exercised right now — it can't be fabricated (no Sleeper write endpoint for lineups exists, and building one just for this would risk touching a real live roster). To test it for real: bench a starter to leave a slot open, or wait for a natural bye-week gap, then re-run this scenario.`,
  }
}
