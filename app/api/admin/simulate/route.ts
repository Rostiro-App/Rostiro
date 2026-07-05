// Dev-only Simulation Suite — the Developer Override Panel's backend.
// Gated to the founder's own account by email (ADMIN_EMAIL) rather than a
// NODE_ENV check, so it works identically on localhost and the deployed
// Vercel app (needed for the panel to be usable for recording/demoing, not
// just local dev). No new role/permissions system — this account is the
// only real user in the DB, and the check runs against a real authenticated
// session either way, never a bypassable client-side flag.

import { createSSRClient, createAdminClient } from '@/lib/supabase'
import { invalidateSimCache } from '@/lib/simTime'
import { runScenario1, runScenario2, runScenario3, runScenario4, clearSimulation, loadFounderLeagues, appendRestore } from '@/lib/simScenarios'
import {
  runLiveUnlockScenario,
  runTouchdownScenario,
  runBigPlayScenario,
  runInterceptionScenario,
  runLeadChangeScenario,
  runNonLiveInjuryScenario,
  runLineupLockScenario,
  runMissionCompleteScenario,
  runCrossLeagueTouchdownScenario,
  runEmptySlotLineupLockScenario,
} from '@/lib/liveSimScenarios'
import { NextResponse, type NextRequest } from 'next/server'
import type { RostiroState, UserPlan } from '@/types'

const VALID_STATES: readonly RostiroState[] = ['draft', 'standard', 'waiver_day', 'game_day', 'film_room']
// The real, current enum (types/index.ts) — not the T-85/T-112 target model
// (Free/Pro/Founder Season Pass/Founding 500), which isn't in Stripe or the
// schema yet. Forcing a value outside this set would just silently fail
// every `.plan` check in production code, not simulate a future plan.
const VALID_PLANS: readonly UserPlan[] = ['free', 'starter', 'pro', 'commissioner']

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
  // Live read, not sim_state — plan is a real column mutation (like
  // players_cache.injury_status in the scenarios), not an ephemeral
  // override, so "current plan" always reflects what production code
  // itself would see right now.
  const { data: founder } = await admin.from('users').select('plan').eq('email', process.env.ADMIN_EMAIL).maybeSingle()
  return NextResponse.json({
    isActive: data?.is_active ?? false,
    simTimestamp: data?.sim_timestamp ?? null,
    forcedState: data?.forced_state ?? null,
    activeScenario: data?.active_scenario ?? null,
    currentPlan: founder?.plan ?? null,
  })
}

export async function POST(request: NextRequest) {
  const user = await requireAdmin()
  // 404, not 401/403 — this endpoint shouldn't announce its own existence
  // to anyone who isn't already the founder.
  if (!user) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  let body: { action?: string; timestamp?: string; state?: string | null; scenario?: string; plan?: string }
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
      case 'force_plan': {
        if (!body.plan || !VALID_PLANS.includes(body.plan as UserPlan)) {
          return NextResponse.json({ error: `plan must be one of ${VALID_PLANS.join(', ')}` }, { status: 400 })
        }
        const { userId } = await loadFounderLeagues(admin)
        const { data: current } = await admin.from('users').select('plan').eq('id', userId).maybeSingle()
        // Snapshot whatever the real value is right now, not a hardcoded
        // default — repeated force_plan calls chain correctly through
        // "Clear simulation"'s reverse-order replay (same as every other
        // real-column mutation in this suite), walking back to the true
        // original plan no matter how many times this was flipped in between.
        await appendRestore(admin, { table: 'users', match: { id: userId }, column: 'plan', value: current?.plan ?? 'free' })
        await admin.from('users').update({ plan: body.plan }).eq('id', userId)
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
          '10': runBigPlayScenario,
          '11': runLineupLockScenario,
          '12': runMissionCompleteScenario,
          '13': runCrossLeagueTouchdownScenario,
          '14': runEmptySlotLineupLockScenario,
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
        return NextResponse.json({ error: 'action must be one of set_time, force_state, force_plan, run_scenario, clear' }, { status: 400 })
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }

  invalidateSimCache()
  return NextResponse.json({ ok: true })
}
