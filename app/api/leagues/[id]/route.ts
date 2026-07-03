// T-71: disconnect a league from Settings. SSR client so RLS ("Users can
// manage own leagues") enforces ownership. Pulse items referencing the
// league keep working — affected_leagues_json is denormalized — and the
// next sync drops its open items because generation no longer produces them.

import { createSSRClient } from '@/lib/supabase'
import { NextResponse } from 'next/server'

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
