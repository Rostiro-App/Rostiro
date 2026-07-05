// T-111: LIVE tab's "Player updates" strip — compact, not cards. Reads
// exactly what Pulse already generated (player_news, injury_alert) for any
// rostered player who isn't in "Live now" right now (pregame, bye,
// inactive, post-game) — zero new generation logic, this file only reads.
//
// pulse_items has no player_id column — the two relevant types' own
// fingerprints already encode it (lib/pulse.ts: `injury:{league}:{player}:
// {status}`, `news:{league}:{newsId}:{player}`), parsed back out here
// rather than adding a migration for something already derivable.

import { createAdminClient } from '@/lib/supabase'

type AdminClient = ReturnType<typeof createAdminClient>

export interface LiveUpdateItem {
  pulseItemId: string
  playerId: string | null
  headline: string
  reasoning: string
  actionUrl: string | null
}

interface PulseItemRow {
  id: string
  type: string
  fingerprint: string | null
  headline: string
  reasoning: string
  action_url: string | null
}

function playerIdFromFingerprint(type: string, fingerprint: string | null): string | null {
  if (!fingerprint) return null
  const parts = fingerprint.split(':')
  if (type === 'injury_alert' && parts[0] === 'injury') return parts[2] ?? null
  if (type === 'player_news' && parts[0] === 'news') return parts[3] ?? null
  return null
}

export async function buildUpdatesDigest(
  admin: AdminClient,
  userId: string,
  excludePlayerIds: Set<string>,
  limit = 5
): Promise<LiveUpdateItem[]> {
  const { data } = await admin
    .from('pulse_items')
    .select('id, type, fingerprint, headline, reasoning, action_url')
    .eq('user_id', userId)
    .eq('status', 'open')
    .in('type', ['player_news', 'injury_alert'])
    .order('created_at', { ascending: false })
    .limit(30)

  const items: LiveUpdateItem[] = []
  for (const row of (data ?? []) as PulseItemRow[]) {
    const playerId = playerIdFromFingerprint(row.type, row.fingerprint)
    if (playerId && excludePlayerIds.has(playerId)) continue // already showing as a live card
    items.push({ pulseItemId: row.id, playerId, headline: row.headline, reasoning: row.reasoning, actionUrl: row.action_url })
    if (items.length >= limit) break
  }
  return items
}
