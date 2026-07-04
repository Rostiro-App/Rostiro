// T-65: Trade Analyzer. Per PRD v3 4.5: verdict + reasoning, ROS value
// comparison, roster construction impact. Same split as Start/Sit and Pulse
// waivers — value and verdict are computed deterministically from ADP (a
// disclosed, transparent formula, not a black-box score); Claude only writes
// the reasoning for numbers already computed.

import { createSSRClient, createAdminClient } from '@/lib/supabase'
import { generateTradeReasoning } from '@/lib/claude'
import { checkAndIncrementUsage, isFreePlan } from '@/lib/usageLimits'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import type { Confidence, TradeAnalysis } from '@/types'

const Body = z.object({
  give: z.array(z.string()).min(1),
  receive: z.array(z.string()).min(1),
  mode: z.enum(['focused', 'balanced', 'savant']).default('balanced'),
})

const WEEKLY_FREE_LIMIT = 3

interface CachedPlayer {
  player_id: string
  name: string
  position: string | null
  adp_sleeper: number | null
}

// Simple, disclosed draft-capital curve — not a claim of true player value,
// just a transparent function of ADP so "value" means the same thing every
// time it's shown. Floors at 0 for anything undrafted-relevant (ADP > 260).
function adpValue(adp: number): number {
  return Math.max(0, 260 - adp)
}

export async function POST(request: Request) {
  const supabase = await createSSRClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const parsed = Body.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'give and receive must each be non-empty arrays of player IDs' }, { status: 400 })
  }
  const { give, receive, mode } = parsed.data

  const allIds = [...give, ...receive]
  const { data: cached, error } = await supabase
    .from('players_cache')
    .select('player_id, name, position, adp_sleeper')
    .eq('platform', 'sleeper')
    .in('player_id', allIds)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const byId = new Map((cached ?? []).map((p) => [p.player_id, p as CachedPlayer]))

  const resolve = (ids: string[]) =>
    ids
      .map((id) => byId.get(id))
      .filter((p): p is CachedPlayer => p !== undefined && p.adp_sleeper != null)

  const givePlayers = resolve(give)
  const receivePlayers = resolve(receive)

  if (givePlayers.length === 0 || receivePlayers.length === 0) {
    return NextResponse.json({ error: 'Could not find ADP data for the selected players' }, { status: 400 })
  }

  const giveValue = givePlayers.reduce((sum, p) => sum + adpValue(p.adp_sleeper!), 0)
  const receiveValue = receivePlayers.reduce((sum, p) => sum + adpValue(p.adp_sleeper!), 0)
  const netValue = receiveValue - giveValue
  const pctDiff = netValue / Math.max(giveValue, 1)

  const verdict: TradeAnalysis['verdict'] = pctDiff > 0.15 ? 'win' : pctDiff < -0.15 ? 'lose' : 'even'
  const confidence: Confidence = Math.abs(pctDiff) > 0.4 ? 'high' : Math.abs(pctDiff) > 0.15 ? 'medium' : 'low'

  const rosValueComparison = `You give up ${Math.round(giveValue)} draft-capital points, receive ${Math.round(receiveValue)} (net ${netValue >= 0 ? '+' : ''}${Math.round(netValue)}).`

  const givePositions = countPositions(givePlayers)
  const receivePositions = countPositions(receivePlayers)
  const rosterImpact = describePositionShift(givePositions, receivePositions)

  // T-103: Free is 3 AI-written trade explanations/week — verdict/value
  // above are already deterministic, so past-quota still returns a correct
  // analysis, just with the plain fallback sentence instead of Claude's prose.
  const fallbackReasoning = `Based on ADP-implied value, this trade is a ${verdict === 'win' ? 'net win' : verdict === 'lose' ? 'net loss' : 'roughly even'} (${Math.round(netValue)} point swing).`

  let reasoning: string
  const admin = createAdminClient()
  const free = await isFreePlan(admin, user.id)
  // Fail open on a metering error — same posture as every other
  // degradation in this codebase; a broken quota check should never block
  // a working trade analysis.
  const withinQuota = !free || (await checkAndIncrementUsage(admin, user.id, 'trade_analysis', WEEKLY_FREE_LIMIT).catch(() => ({ allowed: true, remaining: 0 }))).allowed
  if (!withinQuota) {
    reasoning = fallbackReasoning
  } else {
    try {
      reasoning = await generateTradeReasoning({
        give: givePlayers.map((p) => ({ name: p.name, position: p.position ?? '', adp: p.adp_sleeper! })),
        receive: receivePlayers.map((p) => ({ name: p.name, position: p.position ?? '', adp: p.adp_sleeper! })),
        verdict,
        netValue: Math.round(netValue),
        mode,
      })
    } catch {
      reasoning = fallbackReasoning
    }
  }

  const analysis: TradeAnalysis = { verdict, confidence, reasoning, rosValueComparison, rosterImpact }
  return NextResponse.json({ analysis })
}

function countPositions(players: CachedPlayer[]): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const p of players) {
    const pos = p.position ?? 'FLEX'
    counts[pos] = (counts[pos] ?? 0) + 1
  }
  return counts
}

function describePositionShift(give: Record<string, number>, receive: Record<string, number>): string {
  const positions = new Set([...Object.keys(give), ...Object.keys(receive)])
  const parts: string[] = []
  for (const pos of positions) {
    const delta = (receive[pos] ?? 0) - (give[pos] ?? 0)
    if (delta > 0) parts.push(`+${delta} ${pos}`)
    if (delta < 0) parts.push(`${delta} ${pos}`)
  }
  return parts.length > 0 ? `Roster mix shift: ${parts.join(', ')}.` : 'Roster position mix is unchanged.'
}
