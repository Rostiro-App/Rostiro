// T-141: delete a note. RLS (auth.uid() = user_id) is what actually
// prevents deleting someone else's note — the explicit .eq('user_id', ...)
// below is redundant with it but keeps intent obvious from the route.

import { createSSRClient } from '@/lib/supabase'
import { NextResponse } from 'next/server'

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createSSRClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { error } = await supabase.from('notes').delete().eq('id', id).eq('user_id', user.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
