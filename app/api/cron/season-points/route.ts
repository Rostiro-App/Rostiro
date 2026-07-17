// T-148 sub-scope 1: daily real in-season fantasy points ingestion, backing
// the Trade Analyzer's ADP-to-points blend (lib/seasonPoints.ts). Same
// auth/shape as every other cron route in this codebase
// (app/api/cron/players/route.ts).

import { createAdminClient } from '@/lib/supabase'
import { ingestSeasonPoints } from '@/lib/seasonPoints'
import { SEASON } from '@/lib/sleeper'
import { NextResponse, type NextRequest } from 'next/server'
import { recordCronRun } from '@/lib/cronHeartbeat'
import { isAuthorizedCronRequest } from '@/lib/cronAuth'

export async function GET(request: NextRequest) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  await recordCronRun('season-points')

  try {
    const admin = createAdminClient()
    const result = await ingestSeasonPoints(admin, SEASON)
    return NextResponse.json(result)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
