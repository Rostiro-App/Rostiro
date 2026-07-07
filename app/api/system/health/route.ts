// T-138: uptime check for an external pinger (UptimeRobot, Better Stack
// free tier, etc. — no such service is configured yet, this route just
// gives one a real target). Deliberately unauthenticated: an external
// monitor can't complete a login flow, and this returns nothing sensitive,
// just "is the app up and can it reach Postgres."

import { createAdminClient } from '@/lib/supabase'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const admin = createAdminClient()
    const { error } = await admin.from('users').select('id', { count: 'exact', head: true }).limit(1)
    if (error) throw new Error(error.message)
    return NextResponse.json({ ok: true, db: 'reachable', checkedAt: new Date().toISOString() })
  } catch {
    return NextResponse.json({ ok: false, db: 'unreachable', checkedAt: new Date().toISOString() }, { status: 503 })
  }
}
