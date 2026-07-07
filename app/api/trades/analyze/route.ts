// T-65: Trade Analyzer. Per PRD v3 4.5: verdict + reasoning, ROS value
// comparison, roster construction impact. Same split as Start/Sit and Pulse
// waivers — value and verdict are computed deterministically from ADP (a
// disclosed, transparent formula, not a black-box score); Claude only writes
// the reasoning for numbers already computed.

import { createSSRClient, createAdminClient } from '@/lib/supabase'
import { generateTradeReasoning } from '@/lib/claude'
import { checkAndIncrementUsage, isFreePlan } from '@/lib/usageLimits'
import { blendValue } from '@/lib/seasonPoints'
import { SEASON } from '@/lib/sleeper'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import type { Confidence, TradeAnalysis } from '@/types'

const Body = z.object({
  give: z.array(z.string()).min(1),
  receive: z.array(z.string()).min(1),
  mode: z.enum(['focused', 'balanced', 'savant']).default('balanced'),
  // T-143: optional — general notes (T-141) left on this league feed
  // extra context into the reasoning below. Never required; the
  // deterministic verdict/value never depended on a league to begin with.
  leagueId: z.string().uuid().optional(),
})

const WEEKLY_FREE_LIMIT = 3

interface CachedPlayer {
  player_id: string
  name: string
  position: string | null
  adp_sleeper: number | null
}

interface SeasonPointsRow {
  player_id: string
  weeks_included: number
  points_per_game: number | null
}

interface ValuedPlayer extends CachedPlayer {
  value: number
  pointsPerGame: number | null
  weeksIncluded: number
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
  const { give, receive, mode, leagueId } = parsed.data

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

  // T-148 sub-scope 1: real in-season points (lib/seasonPoints.ts), blended
  // with ADP so a trade's value reflects who's actually producing this
  // season, not just where they were drafted — founder's own words: "ADP
  // doesnt matter after week 2-3 when the real pecking order is shown to
  // the world." A player with no season-points row yet (bye/IR all season,
  // or the migration hasn't run) falls back to pure ADP; never blocks a
  // trade analysis.
  const { data: seasonPointsRows } = await supabase
    .from('player_season_points')
    .select('player_id, weeks_included, points_per_game')
    .eq('platform', 'sleeper')
    .eq('season', SEASON)
    .in('player_id', allIds)
  const seasonPointsById = new Map(
    ((seasonPointsRows ?? []) as SeasonPointsRow[]).map((r) => [r.player_id, r])
  )

  const applyValue = (players: CachedPlayer[]): ValuedPlayer[] =>
    players.map((p) => {
      const seasonRow = seasonPointsById.get(p.player_id)
      return {
        ...p,
        pointsPerGame: seasonRow?.points_per_game ?? null,
        weeksIncluded: seasonRow?.weeks_included ?? 0,
        value: blendValue(adpValue(p.adp_sleeper!), seasonRow?.points_per_game ?? null, seasonRow?.weeks_included ?? 0),
      }
    })

  const valuedGive = applyValue(givePlayers)
  const valuedReceive = applyValue(receivePlayers)

  const giveValue = valuedGive.reduce((sum, p) => sum + p.value, 0)
  const receiveValue = valuedReceive.reduce((sum, p) => sum + p.value, 0)
  const netValue = receiveValue - giveValue
  const pctDiff = netValue / Math.max(giveValue, 1)

  const verdict: TradeAnalysis['verdict'] = pctDiff > 0.15 ? 'win' : pctDiff < -0.15 ? 'lose' : 'even'
  const confidence: Confidence = Math.abs(pctDiff) > 0.4 ? 'high' : Math.abs(pctDiff) > 0.15 ? 'medium' : 'low'

  // "Value points" rather than "draft-capital points" now that real season
  // performance can shift the number for a player with enough season data —
  // still one consistent, disclosed scale either way.
  const anyBlended = [...valuedGive, ...valuedReceive].some((p) => p.weeksIncluded > 0 && p.pointsPerGame !== null)
  const rosValueComparison = `You give up ${Math.round(giveValue)} value points, receive ${Math.round(receiveValue)} (net ${netValue >= 0 ? '+' : ''}${Math.round(netValue)}).${anyBlended ? ' Value blends ADP with real season-to-date scoring where available.' : ''}`

  const givePositions = countPositions(givePlayers)
  const receivePositions = countPositions(receivePlayers)
  const rosterImpact = describePositionShift(givePositions, receivePositions)

  // T-103: Free is 3 AI-written trade explanations/week — verdict/value
  // above are already deterministic, so past-quota still returns a correct
  // analysis, just with the plain fallback sentence instead of Claude's prose.
  const fallbackReasoning = `Based on ADP${anyBlended ? ', blended with real season-to-date scoring where available,' : '-implied value'} this trade is a ${verdict === 'win' ? 'net win' : verdict === 'lose' ? 'net loss' : 'roughly even'} (${Math.round(netValue)} point swing).`

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
    // T-143: general notes (T-141) left on this specific league — extra
    // context only, never a replacement for the ADP numbers above. Never
    // required (leagueId is optional); a missing/failed lookup (migration
    // not run yet) just means no notes feed in.
    let leagueNotes: string[] = []
    if (leagueId) {
      const { data: noteRows } = await supabase
        .from('notes')
        .select('body')
        .eq('user_id', user.id)
        .eq('type', 'general')
        .eq('league_id', leagueId)
      leagueNotes = ((noteRows ?? []) as { body: string }[]).map((n) => n.body)
    }

    try {
      const describe = (p: ValuedPlayer) => ({
        name: p.name,
        position: p.position ?? '',
        adp: p.adp_sleeper!,
        pointsPerGame: p.weeksIncluded > 0 ? p.pointsPerGame : null,
      })
      reasoning = await generateTradeReasoning({
        give: valuedGive.map(describe),
        receive: valuedReceive.map(describe),
        verdict,
        netValue: Math.round(netValue),
        mode,
        leagueNotes,
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
