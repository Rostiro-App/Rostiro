// T-145: read-only admin viewer for app_error_log (T-138).
// Launch security hardening (Codex Packet 01): previously gated by
// `plan === 'commissioner'`, a purchasable product tier, not an
// administrative role — combined with the pre-hardening users-table grant,
// a user could self-promote to commissioner and read the global error log.
// Now gated by lib/adminAuth.ts's ADMIN_USER_ID check, which cannot be
// influenced by anything client-writable. app_error_log's own RLS policy
// only grants service_role access (migration_error_log.sql), meaning this
// route has to go through createAdminClient to read it at all, same as
// every other cron/admin read in this codebase.

import { requireAdmin } from '@/lib/adminAuth'
import { createAdminClient } from '@/lib/supabase'
import { NextResponse } from 'next/server'

const LIMIT = 200

export async function GET() {
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const admin = createAdminClient()
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
