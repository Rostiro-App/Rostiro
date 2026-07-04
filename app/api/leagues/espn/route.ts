import { validateEspnCredentials } from '@/lib/espn'
import { encrypt } from '@/lib/encrypt'
import { createSSRClient, createAdminClient } from '@/lib/supabase'
import { canConnectNewLeague } from '@/lib/usageLimits'
import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'

const SEASON = 2026

const Body = z.object({
  leagueId: z.string().min(1),
  espnS2: z.string().min(10),
  swid: z.string().min(10),
})

export async function POST(request: NextRequest) {
  const supabase = await createSSRClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const parsed = Body.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'leagueId, espnS2, and swid are required' }, { status: 400 })
  }

  const { leagueId, espnS2, swid } = parsed.data
  const credentials = { espnS2, swid }

  const validation = await validateEspnCredentials(leagueId, credentials)
  if (!validation.valid) {
    return NextResponse.json(
      { error: validation.error ?? 'Invalid ESPN credentials' },
      { status: 401 }
    )
  }

  const admin = createAdminClient()

  // T-103: Free is capped at 1 connected league — re-syncing an already-
  // connected league never counts against it, only a genuinely new one.
  const capCheck = await canConnectNewLeague(admin, user.id, 'espn', leagueId, SEASON)
  if (!capCheck.allowed) {
    return NextResponse.json({ error: capCheck.reason }, { status: 402 })
  }

  // Store encrypted credentials
  await admin.from('espn_credentials').upsert({
    user_id: user.id,
    espn_s2: encrypt(espnS2),
    swid: encrypt(swid),
    last_validated_at: new Date().toISOString(),
    is_valid: true,
  }, { onConflict: 'user_id' })

  // Store the league
  const { data, error } = await admin.from('connected_leagues').upsert({
    user_id: user.id,
    platform: 'espn',
    league_id: leagueId,
    league_name: validation.leagueName ?? `ESPN League ${leagueId}`,
    season: SEASON,
    last_synced_at: new Date().toISOString(),
    sync_status: 'ok',
  }, { onConflict: 'user_id,platform,league_id,season' }).select().single()

  if (error) {
    return NextResponse.json({ error: 'Failed to save league' }, { status: 500 })
  }

  return NextResponse.json({ connected: true, league: data })
}
