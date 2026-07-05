// Dev-only Simulation Suite — the time-abstraction layer. lib/rostiroState.ts's
// computeState() was already built as a pure function taking `now` as an
// explicit parameter (its own header comment: "fully testable with
// synthetic timestamps... without any live games") — this file only needs
// to override the small number of real call sites that read the actual
// clock, not the state machine itself.
//
// DB-backed (sim_state, single row) rather than an env var or localStorage —
// same reasoning lib/featureFlags.ts already established: this needs to be
// toggleable instantly from the admin panel, not require a Vercel redeploy.
// Cached briefly for the same reason feature flags are: this gets read on
// every request that computes "what time/state is it," so a Supabase
// round-trip per call would be wasteful for a value that only changes when
// someone's actively driving the simulation panel.

import { createAdminClient } from '@/lib/supabase'
import type { RostiroState } from '@/types'

const CACHE_TTL_MS = 5_000 // short — a dev actively scrubbing the panel needs fast feedback, unlike feature flags' 30s

interface SimState {
  isActive: boolean
  simTimestamp: string | null
  forcedState: RostiroState | null
}

let cache: SimState | null = null
let cachedAt = 0

async function loadSimState(): Promise<SimState> {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('sim_state')
    .select('is_active, sim_timestamp, forced_state')
    .eq('id', 1)
    .maybeSingle()
  // Missing table (migration not run) or any other error: fail open to
  // real time/no override, exactly like every other degrade-gracefully
  // pattern in this codebase — a broken simulation layer must never affect
  // real production behavior.
  if (error || !data) return { isActive: false, simTimestamp: null, forcedState: null }
  return {
    isActive: data.is_active,
    simTimestamp: data.sim_timestamp,
    forcedState: data.forced_state as RostiroState | null,
  }
}

async function getSimState(): Promise<SimState> {
  const now = Date.now()
  if (!cache || now - cachedAt > CACHE_TTL_MS) {
    cache = await loadSimState().catch(() => ({ isActive: false, simTimestamp: null, forcedState: null }))
    cachedAt = now
  }
  return cache
}

/** Real entry point for "what time is it" everywhere in the app. */
export async function simNow(): Promise<Date> {
  const state = await getSimState()
  if (state.isActive && state.simTimestamp) return new Date(state.simTimestamp)
  return new Date()
}

/** Direct state override — bypasses computeState's calendar math entirely
 *  when set, for "put me in Game Day right now" without also having to
 *  fake a kickoff schedule. Returns null when no override is active, so
 *  callers fall through to real computeState(). */
export async function getForcedState(): Promise<RostiroState | null> {
  const state = await getSimState()
  return state.isActive ? state.forcedState : null
}

// Called by /api/admin/simulate after any write, so the panel's next read
// (and this same server instance's next request) reflects the change
// immediately rather than waiting out CACHE_TTL_MS.
export function invalidateSimCache() {
  cache = null
}
