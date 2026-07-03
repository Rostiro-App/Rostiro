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

export type RostiroState = 'draft' | 'standard' | 'waiver_day' | 'game_day' | 'film_room'

const ET_TZ = 'America/New_York'

// How long after the last kickoff of the day a game is assumed still live.
// A single game runs ~3.25-3.5h; this pads for late games / OT rather than
// flipping out of Game Day while people are still mid-game.
const GAME_DURATION_HOURS = 4

// Film Room: Monday evening through Tuesday early afternoon.
// Waiver Day: Tuesday afternoon through Wednesday midday.
// Both are defaults per 6.10 — real per-league cutoffs are a fast-follow.
const FILM_ROOM_END_HOUR_ET = 12 // Tuesday, hour of day (ET) Film Room yields to Waiver Day
const WAIVER_DAY_END_HOUR_ET = 12 // Wednesday, hour of day (ET) Waiver Day yields to Standard

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

export interface ComputeStateInput {
  now: Date
  /** Kickoff times (any timezone — compared as instants) for games happening "today" in ET. */
  todaysKickoffs: Date[]
  /** True if any of the user's connected leagues haven't completed their draft yet. */
  hasIncompleteDraft: boolean
}

export function computeState({ now, todaysKickoffs, hasIncompleteDraft }: ComputeStateInput): RostiroState {
  // Draft State takes priority over everything else while it applies —
  // "This is my year" doesn't pause for a Tuesday waiver window.
  if (hasIncompleteDraft) return 'draft'

  if (todaysKickoffs.length > 0) {
    const earliest = Math.min(...todaysKickoffs.map((k) => k.getTime()))
    const latest = Math.max(...todaysKickoffs.map((k) => k.getTime()))
    const windowEnd = latest + GAME_DURATION_HOURS * 60 * 60 * 1000
    if (now.getTime() >= earliest && now.getTime() <= windowEnd) {
      return 'game_day'
    }
  }

  const { weekday, hour } = partsInEastern(now)
  // 0=Sun 1=Mon 2=Tue 3=Wed 4=Thu 5=Fri 6=Sat

  if (weekday === 1) return 'film_room' // Monday (post-games, per the game-day check above)
  if (weekday === 2) return hour < FILM_ROOM_END_HOUR_ET ? 'film_room' : 'waiver_day' // Tuesday
  if (weekday === 3) return hour < WAIVER_DAY_END_HOUR_ET ? 'waiver_day' : 'standard' // Wednesday

  return 'standard' // Thu/Fri/Sat default to Standard unless a game window caught them above
}

/**
 * Real entry point. `leagueDraftStatuses` — pass `true` for any connected
 * league whose draft hasn't completed; only Sleeper's draft status is wired
 * as of T-79 (see app/api/system/status/route.ts's existing Sleeper draft
 * fetch) — ESPN/Yahoo draft-status detection is a fast-follow once their
 * draft endpoints are wired (5.2 engineering note, T-88 territory).
 */
export async function getRostiroState(
  supabaseAdmin: { from: (table: string) => any },
  leagueDraftStatuses: boolean[]
): Promise<RostiroState> {
  const now = new Date()
  const { dateKey } = partsInEastern(now)

  const { data, error } = await supabaseAdmin
    .from('nfl_schedule')
    .select('kickoff_at')
    .eq('game_date', dateKey)
  if (error) throw new Error(error.message)

  const todaysKickoffs = (data ?? []).map((row: { kickoff_at: string }) => new Date(row.kickoff_at))
  const hasIncompleteDraft = leagueDraftStatuses.some(Boolean)

  return computeState({ now, todaysKickoffs, hasIncompleteDraft })
}
