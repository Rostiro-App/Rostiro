// Dev-only Simulation Suite — the Developer Override Panel's backend.
// Gated to the founder's own account by email (ADMIN_EMAIL) rather than a
// NODE_ENV check, so it works identically on localhost and the deployed
// Vercel app (needed for the panel to be usable for recording/demoing, not
// just local dev). No new role/permissions system — this account is the
// only real user in the DB, and the check runs against a real authenticated
// session either way, never a bypassable client-side flag.

import { createSSRClient, createAdminClient } from '@/lib/supabase'
import { invalidateSimCache } from '@/lib/simTime'
import { runScenario1, runScenario2, runScenario3, runScenario4, clearSimulation } from '@/lib/simScenarios'
import {
  runLiveUnlockScenario,
  runTouchdownScenario,
  runInterceptionScenario,
  runLeadChangeScenario,
  runNonLiveInjuryScenario,
} from '@/lib/liveSimScenarios'
import { NextResponse, type NextRequest } from 'next/server'
import type { RostiroState } from '@/types'

const VALID_STATES: readonly RostiroState[] = ['draft', 'standard', 'waiver_day', 'game_day', 'film_room']

async function requireAdmin() {
  const supabase = await createSSRClient()
  const { data: { user } } = await supabase.auth.getUser()
  const adminEmail = process.env.ADMIN_EMAIL
  if (!user || !adminEmail || user.email !== adminEmail) return null
  return user
}

export async function GET() {
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const admin = createAdminClient()
  const { data } = await admin.from('sim_state').select('is_active, sim_timestamp, forced_state, active_scenario').eq('id', 1).maybeSingle()
  return NextResponse.json({
    isActive: data?.is_active ?? false,
    simTimestamp: data?.sim_timestamp ?? null,
    forcedState: data?.forced_state ?? null,
    activeScenario: data?.active_scenario ?? null,
  })
}

export async function POST(request: NextRequest) {
  const user = await requireAdmin()
  // 404, not 401/403 — this endpoint shouldn't announce its own existence
  // to anyone who isn't already the founder.
  if (!user) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  let body: { action?: string; timestamp?: string; state?: string | null; scenario?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const admin = createAdminClient()

  try {
    switch (body.action) {
      case 'set_time': {
        if (!body.timestamp || Number.isNaN(new Date(body.timestamp).getTime())) {
          return NextResponse.json({ error: 'timestamp must be a valid ISO string' }, { status: 400 })
        }
        await admin.from('sim_state').update({ is_active: true, sim_timestamp: body.timestamp }).eq('id', 1)
        break
      }
      case 'force_state': {
        if (body.state !== null && !VALID_STATES.includes(body.state as RostiroState)) {
          return NextResponse.json({ error: `state must be one of ${VALID_STATES.join(', ')} or null` }, { status: 400 })
        }
        await admin.from('sim_state').update({ is_active: true, forced_state: body.state }).eq('id', 1)
        break
      }
      case 'run_scenario': {
        const scenarios: Record<string, (a: ReturnType<typeof createAdminClient>) => Promise<{ ok: boolean; note: string }>> = {
          '1': runScenario1,
          '2': runScenario2,
          '3': runScenario3,
          '4': runScenario4,
          '5': runLiveUnlockScenario,
          '6': runTouchdownScenario,
          '7': runInterceptionScenario,
          '8': runLeadChangeScenario,
          '9': runNonLiveInjuryScenario,
        }
        const run = body.scenario ? scenarios[body.scenario] : undefined
        if (!run) return NextResponse.json({ error: `scenario must be one of ${Object.keys(scenarios).join(', ')}` }, { status: 400 })
        const result = await run(admin)
        invalidateSimCache()
        return NextResponse.json(result)
      }
      case 'clear': {
        await clearSimulation(admin)
        break
      }
      default:
        return NextResponse.json({ error: 'action must be one of set_time, force_state, run_scenario, clear' }, { status: 400 })
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }

  invalidateSimCache()
  return NextResponse.json({ ok: true })
}
