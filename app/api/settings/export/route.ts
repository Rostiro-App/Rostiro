// T-78: data export — hands the user a JSON download of everything Rostiro
// has on them. Uses the SSR client (RLS-scoped to auth.uid()) rather than
// the admin client, so a bug here can only ever leak the caller's own rows.
// Deliberately excludes raw yahoo_tokens/espn_credentials values (encrypted
// OAuth/session secrets) — connection status is exported, the secret itself
// is not, since a downloaded export file is far more likely to end up
// pasted somewhere insecure than the database is.
//
// Packet 02 token-custody hardening: yahoo_tokens no longer grants
// authenticated any access at all (migration_yahoo_token_custody.sql), so
// this route's own safe-status lookup (created_at only, never the token
// ciphertext) has to go through the admin client instead — explicitly
// scoped to `.eq('user_id', user.id)` so it can only ever return this
// caller's own row, same discipline the SSR client's RLS was providing
// before. Every other table here is unaffected and stays on the SSR client.

import { createSSRClient, createAdminClient } from '@/lib/supabase'
import { NextResponse } from 'next/server'

export async function GET() {
  const supabase = await createSSRClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()

  const [profile, leagues, pulseItems, aiQueries, engagementLog, usageCounters, pushSubs, yahooToken, espnCred] =
    await Promise.all([
      supabase
        .from('users')
        .select('email, plan, mode, push_enabled, trial_ends_at, season_pass_expires_at, created_at')
        .eq('id', user.id)
        .maybeSingle(),
      supabase
        .from('connected_leagues')
        .select('platform, league_name, season, team_name, sync_status, last_synced_at, waiver_cutoff_day, waiver_cutoff_hour, created_at')
        .eq('user_id', user.id),
      supabase
        .from('pulse_items')
        .select('type, priority, headline, reasoning, status, created_at, completed_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false }),
      supabase
        .from('ai_queries')
        .select('query_type, tokens_in, tokens_out, latency_ms, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false }),
      supabase
        .from('engagement_log')
        .select('trigger_type, sent_at')
        .eq('user_id', user.id)
        .order('sent_at', { ascending: false }),
      supabase
        .from('usage_counters')
        .select('feature, week_start, count')
        .eq('user_id', user.id),
      supabase
        .from('push_subscriptions')
        .select('created_at')
        .eq('user_id', user.id),
      admin.from('yahoo_tokens').select('created_at').eq('user_id', user.id).maybeSingle(),
      supabase.from('espn_credentials').select('created_at, is_valid').eq('user_id', user.id).maybeSingle(),
    ])

  if (!profile.data) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })

  // T-107's waiver-cutoff columns and T-103's usage_counters table are each
  // gated behind their own migration, same as everywhere else that reads
  // them — degrade rather than 500 the whole export if either hasn't run.
  let leagueRows = leagues.data
  // PGRST204 is PostgREST's real code for a schema-cache column miss on a
  // live Supabase project — verified directly, not a guess; 42703 (Postgres's
  // own "undefined_column") kept alongside it in case a future direct-SQL
  // path ever hits this differently.
  if (leagues.error?.code === '42703' || leagues.error?.code === 'PGRST204') {
    const fallback = await supabase
      .from('connected_leagues')
      .select('platform, league_name, season, team_name, sync_status, last_synced_at, created_at')
      .eq('user_id', user.id)
    leagueRows = (fallback.data ?? []).map((l) => ({ ...l, waiver_cutoff_day: null, waiver_cutoff_hour: null }))
  }
  const usageCounterRows = usageCounters.error ? [] : usageCounters.data

  const exportPayload = {
    exportedAt: new Date().toISOString(),
    account: profile.data,
    connectedLeagues: leagueRows ?? [],
    connectedPlatformCredentials: {
      yahoo: yahooToken.data ? { connected: true, connectedAt: yahooToken.data.created_at } : { connected: false },
      espn: espnCred.data
        ? { connected: true, connectedAt: espnCred.data.created_at, valid: espnCred.data.is_valid }
        : { connected: false },
    },
    pulseItems: pulseItems.data ?? [],
    aiQueries: aiQueries.data ?? [],
    engagementNotifications: engagementLog.data ?? [],
    usageCounters: usageCounterRows ?? [],
    pushSubscriptionCount: (pushSubs.data ?? []).length,
  }

  return new NextResponse(JSON.stringify(exportPayload, null, 2), {
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="rostiro-data-export-${new Date().toISOString().slice(0, 10)}.json"`,
    },
  })
}
