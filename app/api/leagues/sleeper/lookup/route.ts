import { getSleeperUser, getSleeperLeagues } from '@/lib/sleeper'
import { checkRateLimit, getClientIp } from '@/lib/rateLimit'
import { createAdminClient } from '@/lib/supabase'
import { NextResponse, type NextRequest } from 'next/server'

// T-76: unauthenticated (onboarding hasn't created a session yet) and
// proxies straight to Sleeper's API by username — rate-limited so it can't
// be scripted into a username-enumeration or Sleeper-API-hammering tool.
const RATE_LIMIT = 20
const RATE_WINDOW_SECONDS = 60

export async function GET(request: NextRequest) {
  const admin = createAdminClient()
  const ip = getClientIp(request)
  const { allowed, reason } = await checkRateLimit(admin, `sleeper-lookup:${ip}`, RATE_LIMIT, RATE_WINDOW_SECONDS)
  if (!allowed) {
    if (reason === 'service_unavailable') {
      return NextResponse.json({ error: 'Temporarily unavailable — try again shortly.' }, { status: 503 })
    }
    return NextResponse.json({ error: 'Too many requests — slow down and try again shortly.' }, { status: 429 })
  }

  const username = request.nextUrl.searchParams.get('username')
  if (!username) {
    return NextResponse.json({ error: 'username is required' }, { status: 400 })
  }

  try {
    const user = await getSleeperUser(username)
    const leagues = await getSleeperLeagues(user.user_id)
    return NextResponse.json({ userId: user.user_id, displayName: user.display_name, leagues })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 404 })
  }
}
