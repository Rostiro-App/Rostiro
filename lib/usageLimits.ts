// T-103 / PRD Section 9: Free/Pro usage quota enforcement. Two separate
// concerns that were both promised in the pricing table but never enforced
// anywhere in code — the Lineup page's own comment already admitted it
// ("No weekly free/paid quota yet"):
//   1. checkAndIncrementUsage — Free is 3 start/sit + 3 trade analyses/week.
//   2. canConnectNewLeague — Free is capped at 1 connected league.
// Both check-then-act rather than a single atomic RPC — acceptable at
// current scale (single-digit users, no concurrent-request risk in
// practice); revisit with a real Postgres function if usage ever
// approaches a scale where the race window matters.

type AdminClient = { from: (table: string) => any }

export function currentWeekStart(): string {
  const now = new Date()
  const day = now.getUTCDay() // 0 = Sunday .. 6 = Saturday
  const diffToMonday = (day + 6) % 7 // days since the most recent Monday
  const monday = new Date(now)
  monday.setUTCDate(now.getUTCDate() - diffToMonday)
  monday.setUTCHours(0, 0, 0, 0)
  return monday.toISOString().slice(0, 10)
}

interface PromoWindow {
  startsAt: Date
  endsAt: Date
}

// Business decision, July 2026: the old signup-anchored 7-day trial fired
// during the dead offseason — a July signup burned their whole trial
// before the season even started, with nothing left to convert them once
// real value existed in September. Replaced with a single global window
// (migration_promo_window.sql, one row, id=1) that unlocks Pro depth for
// every free-plan user at once, anchored to the real season calendar
// instead of each user's individual signup date. Founder-adjustable via
// the admin panel (components/admin/SimulationPanel.tsx) — moving the
// season start date later never leaves stale per-user state behind, since
// nothing is computed until this is actually read.
async function getActivePromoWindow(admin: AdminClient): Promise<PromoWindow | null> {
  const { data } = await admin.from('promo_windows').select('starts_at, ends_at').eq('id', 1).maybeSingle()
  if (!data?.starts_at || !data?.ends_at) return null
  return { startsAt: new Date(data.starts_at), endsAt: new Date(data.ends_at) }
}

export interface UsageResult {
  allowed: boolean
  remaining: number
}

// Increments unconditionally when allowed — call this only when you're
// about to actually perform the gated action, never speculatively.
export async function checkAndIncrementUsage(
  admin: AdminClient,
  userId: string,
  feature: string,
  limit: number
): Promise<UsageResult> {
  const weekStart = currentWeekStart()

  const { data: existing } = await admin
    .from('usage_counters')
    .select('count')
    .eq('user_id', userId)
    .eq('feature', feature)
    .eq('week_start', weekStart)
    .maybeSingle()

  const current = existing?.count ?? 0
  if (current >= limit) {
    return { allowed: false, remaining: 0 }
  }

  const { error } = await admin.from('usage_counters').upsert(
    { user_id: userId, feature, week_start: weekStart, count: current + 1, updated_at: new Date().toISOString() },
    { onConflict: 'user_id,feature,week_start' }
  )
  if (error) throw new Error(error.message)

  return { allowed: true, remaining: limit - (current + 1) }
}

// Free plan callers should call this before spending an AI request on
// something they're about to reject — checkAndIncrementUsage only guards
// after the plan check, it doesn't know about plans itself.
//
// Single source of truth for "is this user actually gated right now" —
// every other gate in the app (canConnectNewLeague below, pushToUser in
// lib/engagementTriggers.ts, scoresGated in app/api/system/status/route.ts,
// the Draft Copilot/Film Room/Waiver Day depth gates) all call this
// instead of reading users.plan directly, so the promo window and trial
// logic below applies everywhere consistently, in one place.
//
// A real paid plan (starter/pro/commissioner) is never affected by any of
// this — only a nominally-free user's gates can be lifted, never a paid
// user's downgraded.
export async function isFreePlan(admin: AdminClient, userId: string): Promise<boolean> {
  const { data } = await admin.from('users').select('plan, created_at, trial_ends_at').eq('id', userId).maybeSingle()
  const plan = data?.plan ?? 'free'
  if (plan !== 'free') return false

  const now = new Date()
  const promo = await getActivePromoWindow(admin).catch(() => null)

  if (promo) {
    // The primary mechanic: everyone unlocked while the real season-
    // anchored window is live, regardless of signup date.
    if (now >= promo.startsAt && now <= promo.endsAt) return false

    // Personal fallback trial — only honored for someone who signed up
    // AFTER the promo window already concluded (a late arrival who missed
    // the global week entirely). A user who signed up before or during the
    // window relies on the window itself, never a personal trial on top of
    // it — otherwise a July signup would be right back to burning a trial
    // in the offseason, the exact problem this replaced.
    if (now > promo.endsAt && data?.created_at && new Date(data.created_at) > promo.endsAt) {
      if (data.trial_ends_at && now <= new Date(data.trial_ends_at)) return false
    }
    return true
  }

  // No promo window configured yet (local/dev, or the founder hasn't set
  // one up) — fall back to the classic per-signup trial rather than
  // gating everyone immediately.
  if (data?.trial_ends_at && now <= new Date(data.trial_ends_at)) return false
  return true
}

const FREE_LEAGUE_CAP = 1

export interface LeagueConnectResult {
  allowed: boolean
  reason?: string
}

// Re-syncing an already-connected league (same platform/league_id/season)
// never counts against the cap — only a genuinely new league does.
export async function canConnectNewLeague(
  admin: AdminClient,
  userId: string,
  platform: string,
  leagueId: string,
  season: number
): Promise<LeagueConnectResult> {
  const { data: existing } = await admin
    .from('connected_leagues')
    .select('id')
    .eq('user_id', userId)
    .eq('platform', platform)
    .eq('league_id', leagueId)
    .eq('season', season)
    .maybeSingle()
  if (existing) return { allowed: true }

  if (!(await isFreePlan(admin, userId))) return { allowed: true }

  const { count } = await admin
    .from('connected_leagues')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
  if ((count ?? 0) >= FREE_LEAGUE_CAP) {
    return { allowed: false, reason: `Free plan is limited to ${FREE_LEAGUE_CAP} connected league. Upgrade to Pro to connect more.` }
  }
  return { allowed: true }
}
