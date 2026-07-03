// OS redesign: feeds the bottom ticker strip. Computes ADP movement between
// the latest snapshot and the oldest one inside a 7-day window. Honest
// degradation while history accumulates (snapshots started 2026-07-03):
// with under 2 days of data there are no deltas, so the response carries
// the top of today's board instead and says how many days of history exist.
// No auth — same public posture as /api/draft/players (Draft Kit funnel).

import { createAdminClient } from '@/lib/supabase'
import { NextResponse } from 'next/server'

interface SnapshotRow {
  snapshot_date: string
  player_id: string
  adp: number
}

const WINDOW_DAYS = 7
const MAX_MOVERS = 10
const MIN_DELTA = 3

export async function GET() {
  const admin = createAdminClient()

  const { data: dateRows, error: dateError } = await admin
    .from('adp_snapshots')
    .select('snapshot_date')
    .eq('platform', 'sleeper')
    .order('snapshot_date', { ascending: false })
    .limit(1)

  if (dateError || !dateRows || dateRows.length === 0) {
    return NextResponse.json({ movers: [], top: [], historyDays: 0 })
  }

  const latest = dateRows[0].snapshot_date
  const windowStart = new Date(new Date(latest).getTime() - WINDOW_DAYS * 86_400_000)
    .toISOString()
    .slice(0, 10)

  const [{ data: latestRows }, { data: oldRows }, { data: nameRows }] = await Promise.all([
    admin
      .from('adp_snapshots')
      .select('snapshot_date, player_id, adp')
      .eq('platform', 'sleeper')
      .eq('snapshot_date', latest),
    admin
      .from('adp_snapshots')
      .select('snapshot_date, player_id, adp')
      .eq('platform', 'sleeper')
      .gte('snapshot_date', windowStart)
      .lt('snapshot_date', latest)
      .order('snapshot_date', { ascending: true }),
    admin
      .from('players_cache')
      .select('player_id, name, position')
      .eq('platform', 'sleeper')
      .not('adp_sleeper', 'is', null)
      .order('adp_sleeper', { ascending: true })
      .limit(400),
  ])

  const names = new Map(
    ((nameRows ?? []) as Array<{ player_id: string; name: string; position: string | null }>).map(
      (r) => [r.player_id, r]
    )
  )

  // Oldest snapshot per player inside the window (rows arrive date-ascending,
  // so the first sighting wins).
  const baseline = new Map<string, SnapshotRow>()
  for (const row of (oldRows ?? []) as SnapshotRow[]) {
    if (!baseline.has(row.player_id)) baseline.set(row.player_id, row)
  }

  const historyDates = new Set(((oldRows ?? []) as SnapshotRow[]).map((r) => r.snapshot_date))
  const historyDays = historyDates.size + 1 // + the latest date itself

  const movers = ((latestRows ?? []) as SnapshotRow[])
    .flatMap((row) => {
      const base = baseline.get(row.player_id)
      const info = names.get(row.player_id)
      if (!base || !info) return []
      const delta = Math.round(base.adp - row.adp) // positive = rising
      if (Math.abs(delta) < MIN_DELTA) return []
      return [{ name: info.name, position: info.position, adp: Math.round(row.adp), delta }]
    })
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
    .slice(0, MAX_MOVERS)

  const top = movers.length > 0
    ? []
    : ((latestRows ?? []) as SnapshotRow[])
        .sort((a, b) => a.adp - b.adp)
        .slice(0, 10)
        .flatMap((row) => {
          const info = names.get(row.player_id)
          return info ? [{ name: info.name, position: info.position, adp: Math.round(row.adp) }] : []
        })

  return NextResponse.json({ movers, top, historyDays })
}
