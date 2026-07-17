// Packet 03, P3-5: roster_snapshots sync service. Turns the
// PlatformIntelligenceAdapter contract (Sleeper + ESPN, both real and
// shipped as of P3-2/P3-3) into a durable, last-known-good snapshot log —
// the roster_snapshots table has existed since an earlier packet but had
// no writer until now.
//
// Decision logic (decideSyncAction, computeSnapshotFreshness) is pure and
// separated from the DB-touching orchestrator (syncRosterSnapshot) so
// every acceptance case — last-known-good on failure, the preseason
// empty-roster distinction, freshness states — is testable without a real
// Supabase connection (lib/rosterSnapshotSync.test.ts).

import { createAdminClient } from '@/lib/supabase'
import type {
  ConnectedLeagueContext,
  PlatformIntelligenceAdapter,
  NormalizedRosterSnapshot,
  NormalizedDraftInfo,
  IntelligenceReadResult,
  SnapshotFreshness,
} from '@/lib/platforms'

export type SyncAction = 'saved' | 'kept_last_good' | 'unsupported' | 'approval_pending'

export interface SyncOutcome {
  action: SyncAction
  reason: string
  snapshot: NormalizedRosterSnapshot | null
  hadPreviousSnapshot: boolean
}

// Roster composition doesn't change minute-to-minute the way live scoring
// does — 6 hours balances "don't show week-old data as fresh" against not
// hammering ESPN/Sleeper on every page load. Adjustable per call.
const DEFAULT_STALE_AFTER_MS = 6 * 60 * 60 * 1000

/**
 * Decides what to do with a roster read, given the adapter's own honest
 * status codes plus (when available) the league's draft status. Never
 * mutates anything — purely a decision function.
 *
 * The preseason case this exists to get right: an adapter can return
 * status 'ok' with an empty players[] for two very different reasons —
 * (a) the league genuinely hasn't drafted yet (a real, trustworthy empty
 * roster), or (b) the provider call or parser silently failed to find any
 * entries despite a real, populated roster existing (a false empty that
 * would otherwise overwrite good data). Only (a) is distinguishable from
 * (b) by cross-checking real draft-status metadata — an empty roster is
 * only ever trusted and saved when the draft is confirmed 'not_started'.
 * Any other draft status (or no draft info available at all) treats a
 * surprise-empty roster as a likely partial/failed read and keeps
 * whatever snapshot already exists instead.
 */
export function decideSyncAction(
  rosterResult: IntelligenceReadResult<NormalizedRosterSnapshot>,
  draftResult: IntelligenceReadResult<NormalizedDraftInfo> | null,
  hadPreviousSnapshot: boolean
): SyncOutcome {
  if (rosterResult.status === 'approval_pending') {
    return { action: 'approval_pending', reason: rosterResult.errorReason ?? 'Platform access not yet approved for this integration', snapshot: null, hadPreviousSnapshot }
  }
  if (rosterResult.status === 'unsupported') {
    return { action: 'unsupported', reason: rosterResult.errorReason ?? 'Roster read is not supported for this platform', snapshot: null, hadPreviousSnapshot }
  }
  if (rosterResult.status !== 'ok' || !rosterResult.data) {
    return {
      action: 'kept_last_good',
      reason: rosterResult.errorReason ?? `Provider roster read failed (status: ${rosterResult.status}) — keeping the last successful snapshot rather than saving nothing`,
      snapshot: null,
      hadPreviousSnapshot,
    }
  }

  const snapshot = rosterResult.data
  if (snapshot.players.length === 0) {
    const draftStatus = draftResult?.status === 'ok' ? draftResult.data?.status : null
    if (draftStatus !== 'not_started') {
      return {
        action: 'kept_last_good',
        reason: `Roster read returned 0 players and the league's draft status is '${draftStatus ?? 'unknown/unavailable'}' (not confirmed not_started) — distrusted as a likely partial or failed read rather than saved as a genuine empty roster`,
        snapshot: null,
        hadPreviousSnapshot,
      }
    }
    return { action: 'saved', reason: "League confirmed not_started — genuine empty roster before the draft", snapshot, hadPreviousSnapshot }
  }

  return { action: 'saved', reason: 'Roster read succeeded', snapshot, hadPreviousSnapshot }
}

/**
 * Freshness of the MOST RECENT SAVED snapshot — independent of any single
 * request's outcome. 'approval_pending'/'unsupported' mirror the
 * platform's own static state (Yahoo today; any platform with no roster
 * read capability); 'unavailable' means no successful snapshot has EVER
 * been captured, not that the latest attempt failed (a failed attempt
 * with a prior good snapshot is still 'fresh' or 'stale', never
 * 'unavailable' — that's exactly the point of last-known-good).
 */
export function computeSnapshotFreshness(params: {
  lastSnapshotAt: string | null
  now: Date
  capabilitiesSupportRosterRead: boolean
  approvalPending: boolean
  staleAfterMs?: number
}): SnapshotFreshness {
  if (params.approvalPending) return 'approval_pending'
  if (!params.capabilitiesSupportRosterRead) return 'unsupported'
  if (!params.lastSnapshotAt) return 'unavailable'
  const ageMs = params.now.getTime() - new Date(params.lastSnapshotAt).getTime()
  const staleAfter = params.staleAfterMs ?? DEFAULT_STALE_AFTER_MS
  return ageMs <= staleAfter ? 'fresh' : 'stale'
}

export interface SyncRosterSnapshotResult {
  outcome: SyncOutcome
  freshness: SnapshotFreshness
  lastSnapshotAt: string | null
}

/**
 * Runs one sync pass for a single connected league's owned roster.
 * Server-only (service-role DB access) — callers MUST have already
 * verified the requesting user owns `context.connectedLeagueId` before
 * calling this (see app/api/leagues/[id]/sync-roster/route.ts, which
 * proves ownership via an RLS-scoped select before ever reaching here).
 * This function itself does not and cannot re-check ownership — it
 * trusts the context it's given, same trust boundary as every other
 * server-only lib/platforms/*.ts adapter.
 */
export async function syncRosterSnapshot(
  context: ConnectedLeagueContext,
  adapter: PlatformIntelligenceAdapter
): Promise<SyncRosterSnapshotResult> {
  const admin = createAdminClient()

  const { data: previous } = await admin
    .from('roster_snapshots')
    .select('snapped_at')
    .eq('league_id', context.connectedLeagueId)
    .eq('team_id', context.externalTeamId)
    .order('snapped_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const [rosterResult, draftResult] = await Promise.all([
    adapter.readOwnedRoster(context),
    adapter.readDraftMetadata ? adapter.readDraftMetadata(context) : Promise.resolve(null),
  ])

  const outcome = decideSyncAction(rosterResult, draftResult, !!previous)

  let lastSnapshotAt = previous?.snapped_at ?? null
  if (outcome.action === 'saved' && outcome.snapshot) {
    const snappedAt = new Date().toISOString()
    const { error } = await admin.from('roster_snapshots').insert({
      league_id: context.connectedLeagueId,
      team_id: context.externalTeamId,
      // Full NormalizedRosterSnapshot, including every unresolved player
      // and every identity field — never trimmed before persisting, so
      // dual identity (canonicalPlayerId, sourcePlayerId, confidence,
      // reason) and unresolved-player visibility both survive intact.
      snapshot_json: outcome.snapshot,
      snapped_at: snappedAt,
    })
    if (!error) lastSnapshotAt = snappedAt
    // An insert failure here deliberately falls through to reporting the
    // PREVIOUS snapshot's freshness rather than throwing — the read
    // itself succeeded; only the write failed, and the prior good
    // snapshot (if any) is still the right thing to serve.
  }

  const freshness = computeSnapshotFreshness({
    lastSnapshotAt,
    now: new Date(),
    capabilitiesSupportRosterRead: adapter.capabilities.rosterRead,
    approvalPending: outcome.action === 'approval_pending',
  })

  return { outcome, freshness, lastSnapshotAt }
}
