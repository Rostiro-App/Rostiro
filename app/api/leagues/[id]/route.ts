// T-71: disconnect a league from Settings. SSR client so RLS ("Users can
// manage own leagues") enforces ownership. Pulse items referencing the
// league keep working — affected_leagues_json is denormalized — and the
// next sync drops its open items because generation no longer produces them.
//
// T-107: PATCH sets this league's real waiver-processing moment (day +
// hour ET) so computeState() can use it instead of the global Tue/Wed
// default. Both null = "use the default," the same as never having set it.

import { createSSRClient } from '@/lib/supabase'
import { NextResponse } from 'next/server'
import { z } from 'zod'

const Body = z.object({
  waiverCutoffDay: z.number().int().min(0).max(6).nullable(),
  waiverCutoffHour: z.number().int().min(0).max(23).nullable(),
})

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  const supabase = await createSSRClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('connected_leagues')
    .delete()
    .eq('id', id)
    .select('id')
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'League not found' }, { status: 404 })

  return NextResponse.json({ ok: true })
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  const supabase = await createSSRClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const parsed = Body.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: 'waiverCutoffDay and waiverCutoffHour (0-6 / 0-23, or null) are required' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('connected_leagues')
    .update({
      waiver_cutoff_day: parsed.data.waiverCutoffDay,
      waiver_cutoff_hour: parsed.data.waiverCutoffHour,
    })
    .eq('id', id)
    .select('id')
    .maybeSingle()

  if (error) {
    // migration_waiver_cutoff.sql not run yet — degrade honestly rather
    // than a generic 500. 42703 is Postgres's own "undefined_column" (a
    // direct SQL path); PGRST204 is PostgREST's equivalent for a column
    // missing from its schema cache, which is what a real Supabase project
    // actually returns here — verified live, this is the one that fires in
    // practice, not 42703.
    if (error.code === '42703' || error.code === 'PGRST204') {
      return NextResponse.json({ error: 'Waiver cutoff config not enabled yet — run migration_waiver_cutoff.sql' }, { status: 503 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  if (!data) return NextResponse.json({ error: 'League not found' }, { status: 404 })

  return NextResponse.json({ ok: true })
}
