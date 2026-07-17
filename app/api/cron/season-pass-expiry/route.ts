// T-85: daily downgrade of expired Founder Season Passes (plan='starter')
// back to Free once season_pass_expires_at has passed. Same shape as
// every other scheduled job in this directory — a dedicated cron entry
// rather than a lazy check-on-read, so it doesn't touch isFreePlan's
// existing hot path (called from nearly every gated feature) at all.
//
// Also sends two emails (added for the email suite): a one-time "expiring
// soon" warning ~7 days before expiry (guarded by
// season_pass_expiry_warned_at so it only ever fires once per user), and
// an "expired" notice at the actual downgrade moment.

import { createAdminClient } from '@/lib/supabase'
import { sendSeasonPassExpiringEmail, sendSeasonPassExpiredEmail } from '@/lib/resend'
import { NextResponse, type NextRequest } from 'next/server'
import { recordCronRun } from '@/lib/cronHeartbeat'
import { isAuthorizedCronRequest } from '@/lib/cronAuth'

const WARNING_WINDOW_MIN_DAYS = 6
const WARNING_WINDOW_MAX_DAYS = 8

export async function GET(request: NextRequest) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  await recordCronRun('season-pass-expiry')

  try {
    const admin = createAdminClient()
    const now = new Date()
    const nowIso = now.toISOString()

    // Expiring-soon warning: plan='starter', not yet warned, expiry
    // between 6 and 8 days from now.
    const warnWindowStart = new Date(now.getTime() + WARNING_WINDOW_MIN_DAYS * 24 * 60 * 60 * 1000).toISOString()
    const warnWindowEnd = new Date(now.getTime() + WARNING_WINDOW_MAX_DAYS * 24 * 60 * 60 * 1000).toISOString()

    const { data: toWarn, error: warnSelectError } = await admin
      .from('users')
      .select('id, email')
      .eq('plan', 'starter')
      .is('season_pass_expiry_warned_at', null)
      .gte('season_pass_expires_at', warnWindowStart)
      .lte('season_pass_expires_at', warnWindowEnd)

    if (warnSelectError) throw new Error(warnSelectError.message)

    let warned = 0
    for (const row of toWarn ?? []) {
      try {
        await sendSeasonPassExpiringEmail(row.email)
      } catch {
        // A failed send shouldn't stop the warned_at flag from being set —
        // otherwise a persistent Resend failure would re-attempt (and
        // re-fail) this same user every day for the rest of the window.
      }
      const { error: markError } = await admin
        .from('users')
        .update({ season_pass_expiry_warned_at: nowIso })
        .eq('id', row.id)
      if (!markError) warned += 1
    }

    // Actual expiry downgrade — unchanged logic, now also emails.
    const { data: downgraded, error: downgradeError } = await admin
      .from('users')
      .update({ plan: 'free', season_pass_expires_at: null, season_pass_expiry_warned_at: null })
      .eq('plan', 'starter')
      .lt('season_pass_expires_at', nowIso)
      .select('email')

    if (downgradeError) throw new Error(downgradeError.message)

    for (const row of downgraded ?? []) {
      try {
        await sendSeasonPassExpiredEmail(row.email)
      } catch {
        // Downgrade already succeeded — a failed email must not surface as an error.
      }
    }

    return NextResponse.json({ warned, downgraded: downgraded?.length ?? 0 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
