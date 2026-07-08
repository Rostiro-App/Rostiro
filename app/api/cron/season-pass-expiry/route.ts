// T-85: daily downgrade of expired Founder Season Passes (plan='starter')
// back to Free once season_pass_expires_at has passed. Same shape as
// every other scheduled job in this directory — a dedicated cron entry
// rather than a lazy check-on-read, so it doesn't touch isFreePlan's
// existing hot path (called from nearly every gated feature) at all.

import { createAdminClient } from '@/lib/supabase'
import { NextResponse, type NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const admin = createAdminClient()
    const nowIso = new Date().toISOString()

    const { data, error } = await admin
      .from('users')
      .update({ plan: 'free', season_pass_expires_at: null })
      .eq('plan', 'starter')
      .lt('season_pass_expires_at', nowIso)
      .select('id')

    if (error) throw new Error(error.message)

    return NextResponse.json({ downgraded: data?.length ?? 0 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
