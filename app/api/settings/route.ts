// T-71: Settings — account snapshot + preference writes. Mode is stored on
// the users table (closes T-51) so it follows the user across devices;
// until migration_os_shell.sql adds the column, GET returns mode: null and
// the client keeps trusting localStorage.

import { createSSRClient } from '@/lib/supabase'
import { NextResponse } from 'next/server'
import { z } from 'zod'

const Body = z
  .object({
    mode: z.enum(['focused', 'balanced', 'savant']).optional(),
    pushEnabled: z.boolean().optional(),
    // T-72: hint ids to merge into users.seen_hints (never removed here —
    // "replay tour" resets via its own explicit payload).
    addSeenHints: z.array(z.string().max(64)).max(32).optional(),
    resetSeenHints: z.boolean().optional(),
  })
  .refine(
    (b) =>
      b.mode !== undefined ||
      b.pushEnabled !== undefined ||
      b.addSeenHints !== undefined ||
      b.resetSeenHints !== undefined,
    { message: 'Nothing to update' }
  )

export async function GET() {
  const supabase = await createSSRClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [{ data: profile, error: profileError }, { data: leagues, error: leaguesError }] = await Promise.all([
    supabase
      .from('users')
      .select('email, plan, push_enabled, mode, seen_hints, created_at')
      .eq('id', user.id)
      .maybeSingle(),
    supabase
      .from('connected_leagues')
      .select('id, platform, league_name, waiver_cutoff_day, waiver_cutoff_hour')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true }),
  ])

  // T-107: migration_waiver_cutoff.sql not run yet — retry without the two
  // new columns so the rest of Settings (and league list) still works.
  let leagueRows = leagues
  if (leaguesError?.code === '42703') {
    const fallback = await supabase
      .from('connected_leagues')
      .select('id, platform, league_name')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true })
    leagueRows = (fallback.data ?? []).map((l) => ({ ...l, waiver_cutoff_day: null, waiver_cutoff_hour: null }))
  } else if (leaguesError) {
    return NextResponse.json({ error: leaguesError.message }, { status: 500 })
  }

  // 42703 = a selected column is missing (migration not run) — retry
  // without mode/seen_hints so the rest of Settings still works. A single
  // undefined column fails the whole select, and either one could be the
  // culprit depending on which migrations have run, so both fall back
  // together rather than guessing which one caused it.
  let row = profile
  let modeAvailable = true
  if (profileError?.code === '42703') {
    modeAvailable = false
    const { data: fallback } = await supabase
      .from('users')
      .select('email, plan, push_enabled, created_at')
      .eq('id', user.id)
      .maybeSingle()
    row = fallback ? { ...fallback, mode: null, seen_hints: [] } : null
  } else if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 500 })
  }

  if (!row) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })

  return NextResponse.json({
    email: row.email,
    plan: row.plan,
    pushEnabled: row.push_enabled,
    mode: modeAvailable ? row.mode : null,
    seenHints: (row as { seen_hints?: string[] }).seen_hints ?? [],
    createdAt: row.created_at,
    leagues: (leagueRows ?? []).map((l) => ({
      id: l.id,
      platform: l.platform,
      league_name: l.league_name,
      waiverCutoffDay: l.waiver_cutoff_day,
      waiverCutoffHour: l.waiver_cutoff_hour,
    })),
  })
}

export async function PATCH(request: Request) {
  const supabase = await createSSRClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const parsed = Body.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: 'mode and/or pushEnabled required' }, { status: 400 })
  }

  const update: Record<string, unknown> = {}
  if (parsed.data.mode !== undefined) update.mode = parsed.data.mode
  if (parsed.data.pushEnabled !== undefined) update.push_enabled = parsed.data.pushEnabled

  // Never blind-overwrite seen_hints — read the current array first so a
  // dismissal from one tab doesn't race-clobber one from another, then
  // merge (or reset) and write the result. Reset wins over add if both are
  // somehow sent together — a fresh "replay tour" click, never a partial one.
  if (parsed.data.resetSeenHints) {
    update.seen_hints = []
  } else if (parsed.data.addSeenHints !== undefined) {
    const { data: current } = await supabase.from('users').select('seen_hints').eq('id', user.id).maybeSingle()
    const existing: string[] = (current as { seen_hints?: string[] } | null)?.seen_hints ?? []
    update.seen_hints = [...new Set([...existing, ...parsed.data.addSeenHints])]
  }

  update.updated_at = new Date().toISOString()

  const { error } = await supabase.from('users').update(update).eq('id', user.id)

  if (error) {
    if (error.code === '42703') {
      return NextResponse.json(
        { error: 'Mode persistence not enabled yet — run migration_os_shell.sql' },
        { status: 503 }
      )
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
