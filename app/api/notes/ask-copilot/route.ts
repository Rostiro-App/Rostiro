// T-142: Ask Copilot — trade/scenario queries, built on T-141's notes
// schema (type: 'ask_copilot'). Same standing discipline as the Trade
// Analyzer (app/api/trades/analyze/route.ts) and every generate* in
// lib/claude.ts: a deterministic step finds real candidates from this
// league's actual fetched rosters first; Claude only explains candidates
// it has already been handed, never invents a trade partner.
//
// Sleeper-only for now — same pre-existing gap (ESPN never captures a
// resolvable team_id) that's kept every other roster-dependent feature
// this session Sleeper-first (lib/liveRoster.ts).

import { createSSRClient, createAdminClient } from '@/lib/supabase'
import { getSleeperRosters, getSleeperLeagueUsers } from '@/lib/sleeper'
import { generateAskCopilotReasoning } from '@/lib/claude'
import { checkAndIncrementUsage, isFreePlan } from '@/lib/usageLimits'
import { checkRateLimit } from '@/lib/rateLimit'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import type { Mode } from '@/components/nav/AppShell'

const Body = z.object({
  leagueId: z.string().uuid(),
  body: z.string().min(1).max(280),
  mode: z.enum(['focused', 'balanced', 'savant']).default('balanced'),
})

const WEEKLY_FREE_LIMIT = 3
const BURST_LIMIT_SECONDS = 30

const POSITION_KEYWORDS = ['QB', 'RB', 'WR', 'TE', 'K', 'DEF'] as const

interface CachedPlayer {
  player_id: string
  name: string
  position: string | null
  adp_sleeper: number | null
}

// Same disclosed draft-capital curve as the Trade Analyzer
// (app/api/trades/analyze/route.ts) — kept identical so "value" means the
// same thing in both places.
function adpValue(adp: number): number {
  return Math.max(0, 260 - adp)
}

// Longest-match-wins substring search over real rostered player names —
// deliberately not fuzzy/NLP matching, so the anchor is always a player
// actually on the manager's own roster, never a plausible-sounding guess.
function findAnchor(askText: string, candidates: CachedPlayer[]): CachedPlayer | null {
  const lower = askText.toLowerCase()
  let best: CachedPlayer | null = null
  for (const p of candidates) {
    if (lower.includes(p.name.toLowerCase()) && (!best || p.name.length > best.name.length)) {
      best = p
    }
  }
  return best
}

function findTargetPositions(askText: string, fallback: string | null): string[] {
  const upper = askText.toUpperCase()
  const found = POSITION_KEYWORDS.filter((pos) => new RegExp(`\\b${pos}\\b`).test(upper))
  if (found.length > 0) return found
  return fallback ? [fallback] : []
}

export async function POST(request: Request) {
  const supabase = await createSSRClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const parsed = Body.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid request' }, { status: 400 })
  }
  const { leagueId, body: askText, mode } = parsed.data

  const admin = createAdminClient()

  const burst = await checkRateLimit(admin, `ask_copilot:${user.id}`, 1, BURST_LIMIT_SECONDS)
  if (!burst.allowed) {
    // service_unavailable = the rate-limit check itself failed (fail
    // closed, this route calls a paid Claude API) — distinct from a
    // genuine rate_limited, so a transient DB hiccup is reported honestly
    // rather than implied to be the user asking too often.
    if (burst.reason === 'service_unavailable') {
      return NextResponse.json({ error: 'Temporarily unavailable — try again shortly.' }, { status: 503 })
    }
    return NextResponse.json({ error: 'Ask Copilot too often — wait a moment and try again.' }, { status: 429 })
  }

  const { data: league } = await supabase
    .from('connected_leagues')
    .select('id, platform, league_id, league_name, team_id')
    .eq('id', leagueId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (!league || league.platform !== 'sleeper' || !league.team_id) {
    return NextResponse.json({ error: 'Ask Copilot needs a connected Sleeper league with a resolved team.' }, { status: 400 })
  }

  const rosters = await getSleeperRosters(league.league_id).catch(() => [])
  const myRoster = rosters.find((r) => String(r.roster_id) === league.team_id)
  if (!myRoster) {
    return NextResponse.json({ error: 'Could not find your roster in this league.' }, { status: 400 })
  }

  const allPlayerIds = [...new Set(rosters.flatMap((r) => r.players ?? []))]
  const { data: cached } = await supabase
    .from('players_cache')
    .select('player_id, name, position, adp_sleeper')
    .eq('platform', 'sleeper')
    .in('player_id', allPlayerIds)
  const byId = new Map(((cached ?? []) as CachedPlayer[]).map((p) => [p.player_id, p]))

  const myPlayers = (myRoster.players ?? [])
    .map((id) => byId.get(id))
    .filter((p): p is CachedPlayer => p !== undefined)

  const anchor = findAnchor(askText, myPlayers)
  if (!anchor || anchor.adp_sleeper == null) {
    return NextResponse.json(
      { error: 'Could not find a rostered player matching your question — mention the exact player name.' },
      { status: 400 }
    )
  }

  const targetPositions = findTargetPositions(askText, anchor.position)
  const anchorValue = adpValue(anchor.adp_sleeper)

  const users = await getSleeperLeagueUsers(league.league_id).catch(() => [])
  const teamNameByOwnerId = new Map(users.map((u) => [u.user_id, u.metadata?.team_name || u.display_name]))
  const teamNameByRosterId = new Map(rosters.map((r) => [r.roster_id, teamNameByOwnerId.get(r.owner_id) ?? 'another team']))

  const candidates = rosters
    .filter((r) => r.roster_id !== myRoster.roster_id)
    .flatMap((r) =>
      (r.players ?? [])
        .map((id) => byId.get(id))
        .filter((p): p is CachedPlayer => p !== undefined && p.player_id !== anchor.player_id && p.adp_sleeper != null)
        .filter((p) => targetPositions.length === 0 || targetPositions.includes(p.position ?? ''))
        .map((p) => ({ player: p, teamName: teamNameByRosterId.get(r.roster_id) ?? 'another team' }))
    )
    .sort((a, b) => Math.abs(adpValue(a.player.adp_sleeper!) - anchorValue) - Math.abs(adpValue(b.player.adp_sleeper!) - anchorValue))
    .slice(0, 3)

  if (candidates.length === 0) {
    return NextResponse.json({
      response: `No comparable ${targetPositions.join('/') || 'position'} candidates found on other rosters in this league.`,
    })
  }

  const fallbackResponse = `Comparable trade targets by ADP-implied value: ${candidates
    .map((c) => `${c.player.name} (${c.player.position}, ADP ${Math.round(c.player.adp_sleeper!)}, rostered by ${c.teamName})`)
    .join('; ')}.`

  let response: string
  const free = await isFreePlan(admin, user.id)
  const withinQuota = !free || (await checkAndIncrementUsage(admin, user.id, 'ask_copilot', WEEKLY_FREE_LIMIT).catch(() => ({ allowed: true, remaining: 0 }))).allowed
  if (!withinQuota) {
    response = fallbackResponse
  } else {
    try {
      response = await generateAskCopilotReasoning({
        askText,
        anchor: { name: anchor.name, position: anchor.position ?? '', adp: anchor.adp_sleeper },
        candidates: candidates.map((c) => ({
          name: c.player.name,
          position: c.player.position ?? '',
          adp: c.player.adp_sleeper!,
          teamName: c.teamName,
        })),
        mode: mode as Mode,
      })
    } catch {
      response = fallbackResponse
    }
  }

  const { error: insertError } = await supabase
    .from('notes')
    .insert({ user_id: user.id, type: 'ask_copilot', body: askText, league_id: leagueId, response, status: 'answered' })
  // Same degrade-gracefully posture as app/api/notes/route.ts — a failed
  // save (migration not run yet, etc.) shouldn't block the answer itself.
  void insertError

  return NextResponse.json({ response })
}
