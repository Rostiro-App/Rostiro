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

async function getPlan(admin: AdminClient, userId: string): Promise<string> {
  const { data } = await admin.from('users').select('plan').eq('id', userId).maybeSingle()
  return data?.plan ?? 'free'
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
export async function isFreePlan(admin: AdminClient, userId: string): Promise<boolean> {
  return (await getPlan(admin, userId)) === 'free'
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

  if ((await getPlan(admin, userId)) !== 'free') return { allowed: true }

  const { count } = await admin
    .from('connected_leagues')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
  if ((count ?? 0) >= FREE_LEAGUE_CAP) {
    return { allowed: false, reason: `Free plan is limited to ${FREE_LEAGUE_CAP} connected league. Upgrade to Pro to connect more.` }
  }
  return { allowed: true }
}
