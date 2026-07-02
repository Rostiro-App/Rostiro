import { createSSRClient, createAdminClient } from '@/lib/supabase'
import { fetchAllSleeperLeagues } from '@/lib/sleeper'
import { normalizeSleeperLeague } from '@/lib/normalize'
import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'

const Body = z.object({ username: z.string().min(1) })

export async function POST(request: NextRequest) {
  const supabase = await createSSRClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const parsed = Body.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'username is required' }, { status: 400 })
  }

  try {
    const rawLeagues = await fetchAllSleeperLeagues(parsed.data.username)
    if (rawLeagues.length === 0) {
      return NextResponse.json({ error: 'No leagues found for that username' }, { status: 404 })
    }

    const admin = createAdminClient()
    const inserted = []

    for (const raw of rawLeagues) {
      const normalized = normalizeSleeperLeague(raw.league, raw.myRoster.roster_id)

      const { data, error } = await admin
        .from('connected_leagues')
        .upsert({
          user_id: user.id,
          platform: 'sleeper',
          league_id: normalized.leagueId,
          league_name: normalized.leagueName,
          season: normalized.season,
          scoring_settings_json: normalized.scoringSettings,
          roster_slots_json: normalized.rosterSlots,
          team_id: normalized.myTeamId,
          team_name: normalized.myTeamName,
          last_synced_at: normalized.lastSyncedAt,
          sync_status: 'ok',
        }, { onConflict: 'user_id,platform,league_id,season' })
        .select()
        .single()

      if (!error && data) inserted.push(data)
    }

    return NextResponse.json({ connected: inserted.length, leagues: inserted })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
