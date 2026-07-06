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

  // T-123: name lives on Supabase Auth's own user_metadata, not the public
  // users table — same field app/api/pulse/sleeper/route.ts already reads
  // for the Pulse greeting, kept as the one source of truth rather than
  // duplicating it onto a users.name column.
  const meta = (user.user_metadata ?? {}) as Record<string, unknown>
  const fullName = typeof meta.full_name === 'string' ? meta.full_name : null

  const [{ data: profile, error: profileError }, { data: leagues, error: leaguesError }, { data: founderRow, error: founderError }] = await Promise.all([
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
    // T-111: queried separately from the profile select above rather than
    // folded into it — a single undefined column fails the whole select,
    // and this one comes from its own independent migration
    // (migration_founder_recognition.sql), so it needs to degrade on its
    // own rather than compounding the existing mode/seen_hints fallback.
    supabase.from('users').select('founding_number').eq('id', user.id).maybeSingle(),
  ])

  const foundingNumber = founderError?.code === '42703' || founderError?.code === 'PGRST204'
    ? null
    : (founderRow as { founding_number: number | null } | null)?.founding_number ?? null

  // T-107: migration_waiver_cutoff.sql not run yet — retry without the two
  // new columns so the rest of Settings (and league list) still works.
  let leagueRows = leagues
  // PGRST204 is PostgREST's real code for a schema-cache column miss on a
  // live Supabase project — verified directly; 42703 kept for a direct-SQL path.
  if (leaguesError?.code === '42703' || leaguesError?.code === 'PGRST204') {
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
  if (profileError?.code === '42703' || profileError?.code === 'PGRST204') {
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
    fullName,
    plan: row.plan,
    foundingNumber,
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
    // 42703 is Postgres's own "undefined_column" (a direct SQL path);
    // PGRST204 is PostgREST's equivalent for a column missing from its
    // schema cache, which is what a real Supabase project actually returns
    // here — verified live against this project, not a guess. Whichever
    // migration is actually missing gets named in the message rather than
    // a generic one, since mode and seen_hints come from two different
    // migrations that can be run independently of each other.
    if (error.code === '42703' || error.code === 'PGRST204') {
      const migration = update.mode !== undefined ? 'migration_os_shell.sql' : 'migration_experience.sql'
      return NextResponse.json(
        { error: `Setting not enabled yet — run ${migration}` },
        { status: 503 }
      )
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
