// Cron liveness heartbeat. Same posture as lib/errorLog.ts: a best-effort
// side-write that must never throw or slow down the cron it's stamping.
//
// Each cron route calls recordCronRun(name) right after its auth check, so the
// stamp means "this handler was invoked and authorized" — independent of
// whether the run did any external work (e.g. live-scores no-ops off-season but
// still stamps). A Supabase pg_cron job (check_cron_heartbeats) compares each
// row's last_run_at against its stale_after and pushes to n8n -> Discord when a
// cron goes silent. This catches the failure app_error_log can't: a cron that
// stops running entirely, so there's no error row to page on.

import { createAdminClient } from '@/lib/supabase'

export async function recordCronRun(cronName: string): Promise<void> {
  try {
    const admin = createAdminClient()
    await admin.from('cron_heartbeat').upsert(
      { cron_name: cronName, last_run_at: new Date().toISOString(), last_status: 'ok' },
      { onConflict: 'cron_name' }
    )
  } catch {
    // Heartbeat infra must never be why a cron fails. Swallow everything —
    // a missed stamp just means the checker may page us; a thrown error here
    // could break a real Sunday score sync.
  }
}
