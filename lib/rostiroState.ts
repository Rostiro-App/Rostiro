// T-79: Rostiro States engine (PRD 6.10). Deterministic — no Claude call,
// per 10.1's Deterministic-First rule. Two layers:
//   1. computeState() — pure function, takes `now` + today's kickoff times
//      + draft status, returns the state. Fully testable with synthetic
//      timestamps ("pretend it's Sunday 1pm") without any live games —
//      this is what let States be built in Tier 1, before the season starts.
//   2. getRostiroState() — the real entry point, queries nfl_schedule and
//      calls computeState() with real data.
//
// Waiver Day / Film Room boundaries below are the "sane per-platform
// defaults" PRD 6.10 explicitly calls for, since per-league waiver-cutoff
// config (onboarding Step 4) doesn't exist yet. Refine with real per-league
// data once that ships — these constants are deliberately isolated so that's
// a small change, not a rewrite.

import { isFeatureEnabled } from '@/lib/featureFlags'
import type { RostiroState } from '@/types'

export type { RostiroState }

const ET_TZ = 'America/New_York'

// How long after the last kickoff of the day a game is assumed still live.
// A single game runs ~3.25-3.5h; this pads for late games / OT rather than
// flipping out of Game Day while people are still mid-game.
const GAME_DURATION_HOURS = 4

// T-97: how long before the day's earliest kickoff Game Day (pregame ramp)
// activates. Covers the real 11:45am-Sunday "did I set my lineup" scramble
// (PRD 7, 6.10 v5.5 note) ahead of a 1pm ET slate, rather than requiring a
// game to have actually started.
const PREGAME_RAMP_HOURS = 3

// Film Room: Monday evening through Tuesday early afternoon.
// Waiver Day: Tuesday afternoon through Wednesday midday.
// Both are defaults per 6.10 — real per-league cutoffs are a fast-follow.
const FILM_ROOM_END_HOUR_ET = 12 // Tuesday, hour of day (ET) Film Room yields to Waiver Day
const WAIVER_DAY_END_HOUR_ET = 12 // Wednesday, hour of day (ET) Waiver Day yields to Standard

// T-107: how far ahead of a league's actual configured waiver-processing
// moment its own Waiver Day window opens — matches the global default's
// implied span (Tue noon -> Wed noon is exactly 24h) so a configured
// league doesn't feel shorter or longer than the default one did.
const WAIVER_WINDOW_HOURS = 24

function partsInEastern(date: Date): { weekday: number; hour: number; dateKey: string } {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: ET_TZ,
    weekday: 'short',
    hour: 'numeric',
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  const parts = Object.fromEntries(fmt.formatToParts(date).map((p) => [p.type, p.value]))
  const weekdayMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }
  // hour12:false can render midnight as "24" in some ICU implementations.
  const hour = Number(parts.hour) % 24
  return {
    weekday: weekdayMap[parts.weekday],
    hour,
    dateKey: `${parts.year}-${parts.month}-${parts.day}`,
  }
}

/** A league's real waiver-processing moment — recurring weekly, ET. */
export interface LeagueWaiverCutoff {
  dayOfWeek: number // 0=Sun..6=Sat, matching partsInEastern's convention
  hourEt: number // 0-23
}

export interface ComputeStateInput {
  now: Date
  /** Kickoff times (any timezone — compared as instants) for games happening "today" in ET. */
  todaysKickoffs: Date[]
  /** True if any of the user's connected leagues haven't completed their draft yet. */
  hasIncompleteDraft: boolean
  /** T-107: real configured cutoffs, one per league that has set one. Leagues that haven't are NOT represented here — see hasUnconfiguredLeague. */
  leagueWaiverCutoffs?: LeagueWaiverCutoff[]
  /** T-107: true when at least one connected league has no configured cutoff and so still needs the global Tue/Wed default. Defaults to true so existing callers that don't pass this keep today's exact behavior. */
  hasUnconfiguredLeague?: boolean
}

// A per-league cutoff is a recurring weekly instant — this walks FORWARD
// hour by hour from `now` (at most 7 days) re-using the same ET-conversion
// partsInEastern already gets right, rather than hand-rolling UTC-offset/DST
// math for "what instant is Wednesday 3am ET this week." Forward, not
// backward: the cutoff we care about is the upcoming one (today's hasn't
// happened yet if `now` is earlier in the day) — searching backward would
// wrongly land on last week's occurrence whenever `now`'s hour is before
// the target hour on the target day. Cheap: at most 169 iterations, and
// only run per configured league, per status poll.
function nextOccurrence(now: Date, dayOfWeek: number, hourEt: number): Date {
  const HOUR_MS = 60 * 60 * 1000
  for (let stepsAhead = 0; stepsAhead <= 24 * 7; stepsAhead++) {
    const candidate = new Date(now.getTime() + stepsAhead * HOUR_MS)
    const { weekday, hour } = partsInEastern(candidate)
    if (weekday === dayOfWeek && hour === hourEt) return candidate
  }
  return now // unreachable — every weekday/hour pair recurs within 7 days
}

export function computeState({
  now,
  todaysKickoffs,
  hasIncompleteDraft,
  leagueWaiverCutoffs = [],
  hasUnconfiguredLeague = true,
}: ComputeStateInput): RostiroState {
  // Draft State takes priority over everything else while it applies —
  // "This is my year" doesn't pause for a Tuesday waiver window.
  if (hasIncompleteDraft) return 'draft'

  if (todaysKickoffs.length > 0) {
    const earliest = Math.min(...todaysKickoffs.map((k) => k.getTime()))
    const latest = Math.max(...todaysKickoffs.map((k) => k.getTime()))
    const windowStart = earliest - PREGAME_RAMP_HOURS * 60 * 60 * 1000
    const windowEnd = latest + GAME_DURATION_HOURS * 60 * 60 * 1000
    if (now.getTime() >= windowStart && now.getTime() <= windowEnd) {
      return 'game_day'
    }
  }

  // T-107: a league with a real configured cutoff overrides the global
  // assumption for itself — if any connected league is inside its own
  // configured window right now, Waiver Day wins regardless of the literal
  // calendar day, matching 6.10's "earliest/broadest transition" rule.
  for (const cutoff of leagueWaiverCutoffs) {
    const cutoffMoment = nextOccurrence(now, cutoff.dayOfWeek, cutoff.hourEt).getTime()
    const windowStart = cutoffMoment - WAIVER_WINDOW_HOURS * 60 * 60 * 1000
    if (now.getTime() >= windowStart && now.getTime() <= cutoffMoment) {
      return 'waiver_day'
    }
  }

  const { weekday, hour } = partsInEastern(now)
  // 0=Sun 1=Mon 2=Tue 3=Wed 4=Thu 5=Fri 6=Sat

  if (weekday === 1) return 'film_room' // Monday (post-games, per the game-day check above)
  if (weekday === 2 && hour < FILM_ROOM_END_HOUR_ET) return 'film_room' // Tuesday morning

  // The blanket Tue-PM/Wed-AM Waiver Day window only applies while at least
  // one connected league hasn't configured a real cutoff — an account
  // where every league has customized shouldn't keep getting a generic
  // window none of its leagues actually use.
  if (hasUnconfiguredLeague) {
    if (weekday === 2) return 'waiver_day' // Tuesday afternoon
    if (weekday === 3 && hour < WAIVER_DAY_END_HOUR_ET) return 'waiver_day' // Wednesday morning
  }

  return 'standard' // Thu/Fri/Sat default to Standard unless a game window caught them above
}

/**
 * Real entry point. `leagueDraftStatuses` — pass `true` for any connected
 * league whose draft hasn't completed; only Sleeper's draft status is wired
 * as of T-79 (see app/api/system/status/route.ts's existing Sleeper draft
 * fetch) — ESPN/Yahoo draft-status detection is a fast-follow once their
 * draft endpoints are wired (5.2 engineering note, T-88 territory).
 *
 * `leagueWaiverConfigs` — one entry per connected league, T-107. Pass
 * `{ waiverCutoffDay: null, waiverCutoffHour: null }` for a league that
 * hasn't configured a real cutoff yet (or omit the whole array) — callers
 * that don't pass this at all keep the exact pre-T-107 global-default
 * behavior.
 */
export async function getRostiroState(
  supabaseAdmin: { from: (table: string) => any },
  leagueDraftStatuses: boolean[],
  leagueWaiverConfigs: { waiverCutoffDay: number | null; waiverCutoffHour: number | null }[] = []
): Promise<RostiroState> {
  // PRD 6.10's own requirement: this is "new logic activating automatically
  // for 100% of users on the highest-traffic day of the week," so it needs
  // an instant kill switch back to Standard State — checked here, at the
  // one real entry point, so every caller gets it for free rather than
  // having to remember to check it themselves.
  if (!(await isFeatureEnabled('rostiro_states').catch(() => false))) {
    return 'standard'
  }

  const now = new Date()
  const { dateKey } = partsInEastern(now)

  const { data, error } = await supabaseAdmin
    .from('nfl_schedule')
    .select('kickoff_at')
    .eq('game_date', dateKey)
  if (error) throw new Error(error.message)

  const todaysKickoffs = (data ?? []).map((row: { kickoff_at: string }) => new Date(row.kickoff_at))
  const hasIncompleteDraft = leagueDraftStatuses.some(Boolean)

  const leagueWaiverCutoffs: LeagueWaiverCutoff[] = leagueWaiverConfigs
    .filter((c): c is { waiverCutoffDay: number; waiverCutoffHour: number } => c.waiverCutoffDay !== null && c.waiverCutoffHour !== null)
    .map((c) => ({ dayOfWeek: c.waiverCutoffDay, hourEt: c.waiverCutoffHour }))
  const hasUnconfiguredLeague =
    leagueWaiverConfigs.length === 0 || leagueWaiverConfigs.some((c) => c.waiverCutoffDay === null || c.waiverCutoffHour === null)

  return computeState({ now, todaysKickoffs, hasIncompleteDraft, leagueWaiverCutoffs, hasUnconfiguredLeague })
}
