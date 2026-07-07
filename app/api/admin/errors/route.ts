// T-145: read-only admin viewer for app_error_log (T-138). Gated to the
// founder account the same way Profile's Founding 500 panel is
// (plan === 'commissioner') — checked server-side here, never trusted from
// the client, since app_error_log's own RLS policy only grants service_role
// access (migration_error_log.sql), meaning this route has to go through
// createAdminClient to read it at all, same as every other cron/admin
// read in this codebase.

import { createSSRClient, createAdminClient } from '@/lib/supabase'
import { NextResponse } from 'next/server'

const LIMIT = 200

export async function GET() {
  const supabase = await createSSRClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const { data: userRow } = await admin.from('users').select('plan').eq('id', user.id).maybeSingle()
  if (userRow?.plan !== 'commissioner') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { data, error } = await admin
    .from('app_error_log')
    .select('id, source, message, stack, context, created_at')
    .order('created_at', { ascending: false })
    .limit(LIMIT)

  if (error) {
    // 42P01 = migration_error_log.sql not run yet — an empty log reads
    // honestly as "nothing logged" rather than a broken page.
    if (error.code === '42P01' || error.code === 'PGRST205') return NextResponse.json({ errors: [] })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ errors: data ?? [] })
}
