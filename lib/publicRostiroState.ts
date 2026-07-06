// T-124: a marketing-safe variant of getRostiroState (lib/rostiroState.ts)
// for the logged-out homepage/Features hero. Reuses the exact same pure
// computeState() function and the same nfl_schedule data the real product
// reads — Game Day, Film Room, and Waiver Day are already universal/
// schedule-driven, not per-user, so they transfer over unchanged. Draft
// State is the one exception: the real product triggers it from a specific
// user's incomplete draft, which doesn't exist on a public page, so this
// uses a calendar window instead (roughly when most leagues are actually
// drafting) — the marketing site should read as "get your team ready"
// during that stretch, not fall through to whatever the bare weekday
// math would otherwise say.

import { createAdminClient } from '@/lib/supabase'
import { computeState, partsInEastern, type RostiroState } from '@/lib/rostiroState'
import { isFeatureEnabled } from '@/lib/featureFlags'

// 2026 season: preseason begins Aug 6, regular season opens Sept 9 (PRD §1).
// Window starts at the marketing launch date itself (July 6, 2026, per
// Rostiro_Marketing_Plan_v1.md), not just when drafts actually start —
// verified live that a narrower Aug 1 start let the bare weekday math fall
// through to Film Room ("reviewing what just happened") in the middle of
// July, before a single game has been played, which reads as broken rather
// than clever. The entire pre-season stretch should read as "get ready,"
// not flicker through mid-season states that don't apply yet.
const DRAFT_WINDOW_START = new Date('2026-07-01T00:00:00-04:00')
const DRAFT_WINDOW_END = new Date('2026-09-09T00:00:00-04:00')

export async function getPublicRostiroState(): Promise<RostiroState> {
  // Same global kill switch the real product respects (PRD 6.10: "the
  // highest-risk addition, since it activates automatically for every user
  // on the highest-traffic day") — if it's off in-product, the marketing
  // site shouldn't show state-driven styling either.
  if (!(await isFeatureEnabled('rostiro_states').catch(() => false))) {
    return 'standard'
  }

  const now = new Date()
  const { dateKey } = partsInEastern(now)

  const admin = createAdminClient()
  const { data } = await admin.from('nfl_schedule').select('kickoff_at').eq('game_date', dateKey)
  const todaysKickoffs = (data ?? []).map((row: { kickoff_at: string }) => new Date(row.kickoff_at))

  const isDraftWindow = now >= DRAFT_WINDOW_START && now < DRAFT_WINDOW_END

  return computeState({
    now,
    todaysKickoffs,
    hasIncompleteDraft: isDraftWindow,
    leagueWaiverCutoffs: [],
    hasUnconfiguredLeague: true,
  })
}
