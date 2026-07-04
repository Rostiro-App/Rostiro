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

  const [{ data: profile, error: profileError }, { data: leagues }] = await Promise.all([
    supabase
      .from('users')
      .select('email, plan, push_enabled, mode, seen_hints, created_at')
      .eq('id', user.id)
      .maybeSingle(),
    supabase
      .from('connected_leagues')
      .select('id, platform, league_name')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true }),
  ])

  // 42703 = mode column missing (migration not run) — retry without it so
  // the rest of Settings still works.
  let row = profile
  let modeAvailable = true
  if (profileError?.code === '42703') {
    modeAvailable = false
    const { data: fallback } = await supabase
      .from('users')
      .select('email, plan, push_enabled, created_at')
      .eq('id', user.id)
      .maybeSingle()
    row = fallback ? { ...fallback, mode: null } : null
  } else if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 500 })
  }

  if (!row) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })

  return NextResponse.json({
    email: row.email,
    plan: row.plan,
    pushEnabled: row.push_enabled,
    mode: modeAvailable ? row.mode : null,
    createdAt: row.created_at,
    leagues: leagues ?? [],
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
