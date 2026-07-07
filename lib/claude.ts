// Claude API wrapper. Model is claude-sonnet-5 — the current Sonnet-tier
// model, same cost tier as the claude-sonnet-4-6 named in the PRD (which is
// now the previous generation). Thinking is disabled and effort is low: this
// wrapper is only ever asked for a short, factual explanation of numbers we
// already computed, not open-ended reasoning — keep it cheap and fast.

import Anthropic from '@anthropic-ai/sdk'
import { ClaudeAPIError, type DraftStrategy } from '@/types'
import { STRATEGY_DESCRIPTIONS } from '@/lib/draftBoard'
import type { Mode } from '@/components/nav/AppShell'
import { checkCircuitBreaker, recordApiCall } from '@/lib/observability'

const MODEL = 'claude-sonnet-5'

let client: Anthropic | null = null

function getClient(): Anthropic {
  if (!client) {
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) throw new ClaudeAPIError('ANTHROPIC_API_KEY is not set')
    client = new Anthropic({ apiKey })
  }
  return client
}

// T-84: every Claude call in the app goes through this one function —
// circuit-checked and latency-logged here rather than duplicated across
// the four generation functions below. Throws ClaudeAPIError directly so
// each call site below no longer needs its own try/catch just to
// re-wrap the SDK's error.
async function createMessage(params: Anthropic.MessageCreateParamsNonStreaming): Promise<Anthropic.Message> {
  await checkCircuitBreaker('claude')
  const start = Date.now()
  try {
    const message = await getClient().messages.create(params)
    await recordApiCall('claude', 'messages.create', Date.now() - start, true)
    return message
  } catch (err) {
    await recordApiCall('claude', 'messages.create', Date.now() - start, false)
    const msg = err instanceof Error ? err.message : 'Unknown error'
    throw new ClaudeAPIError(`Claude request failed: ${msg}`)
  }
}

// T-102 / PRD 3: the three personas aren't just card density — "Focused:
// tell me what to do" vs "Savant: AI advisory not directive" is a real
// difference in what Claude is asked to write, not just how much of it a
// component shows. Appended to every system prompt below rather than
// replacing the existing deterministic-numbers-only instruction — the tone
// changes, the "never invent stats" rule doesn't.
function toneInstruction(mode: Mode): string {
  switch (mode) {
    case 'focused':
      return 'State the verdict in the first sentence. One additional sentence of why, at most. No hedging, no "on the other hand," no caveats.'
    case 'savant':
      return 'Write as an advisory, never as an instruction — present the data and let the manager reach their own call. Never phrase it as what they should do.'
    case 'balanced':
    default:
      return 'Direct, no hedging filler.'
  }
}

interface StartSitReasoningInput {
  starterName: string
  starterPosition: string
  starterAdp: number
  benchName: string
  benchPosition: string
  benchAdp: number
  mode: Mode
}

// Claude only writes the prose here — the verdict and confidence are computed
// deterministically from the ADP gap before this is ever called (see
// app/api/lineup/sleeper/route.ts). This keeps the one place we spend API
// tokens scoped to "explain these numbers," never "decide the outcome."
export async function generateStartSitReasoning(input: StartSitReasoningInput): Promise<string> {
  const message = await createMessage({
    model: MODEL,
    max_tokens: 200,
    thinking: { type: 'disabled' },
    output_config: { effort: 'low' },
    system:
      `You write short, factual fantasy football lineup explanations. Use only the numbers given to you. Never invent stats, matchups, or injury information that was not provided. Two to three sentences. ${toneInstruction(input.mode)}`,
    messages: [
      {
        role: 'user',
        content: `${input.starterName} (${input.starterPosition}, ADP ${input.starterAdp}) is currently started over ${input.benchName} (${input.benchPosition}, ADP ${input.benchAdp}), who is on the bench. Explain why the bench player might be the better start, based only on the ADP gap.`,
      },
    ],
  })

  const textBlock = message.content.find((b) => b.type === 'text')
  if (!textBlock || textBlock.type !== 'text') {
    throw new ClaudeAPIError('Claude returned no text content')
  }
  return textBlock.text.trim()
}

interface TradeReasoningInput {
  give: Array<{ name: string; position: string; adp: number; pointsPerGame?: number | null }>
  receive: Array<{ name: string; position: string; adp: number; pointsPerGame?: number | null }>
  verdict: 'win' | 'lose' | 'even'
  netValue: number
  mode: Mode
  // T-143: general notes (T-141) the manager left on the league this trade
  // belongs to — extra context only, never a replacement for the ADP
  // numbers the verdict is actually computed from.
  leagueNotes?: string[]
}

// Same split as generateStartSitReasoning: verdict and value are computed
// deterministically from ADP before this is called (see
// app/api/trades/analyze/route.ts) — Claude explains the numbers, it doesn't
// decide the trade.
export async function generateTradeReasoning(input: TradeReasoningInput): Promise<string> {
  // T-148 sub-scope 1: pointsPerGame is only set once real season games
  // have accumulated (app/api/trades/analyze/route.ts's blendValue) —
  // included here so Claude can explain the real-performance half of the
  // blend for a player who has one, without inventing it for a player who
  // doesn't.
  const describe = (side: TradeReasoningInput['give']) =>
    side
      .map((p) => `${p.name} (${p.position}, ADP ${Math.round(p.adp)}${p.pointsPerGame != null ? `, ${p.pointsPerGame.toFixed(1)} real fantasy points/game this season` : ''})`)
      .join(', ')

  const hasNotes = !!input.leagueNotes && input.leagueNotes.length > 0
  const hasSeasonPoints = [...input.give, ...input.receive].some((p) => p.pointsPerGame != null)

  const message = await createMessage({
    model: MODEL,
    max_tokens: 300,
    thinking: { type: 'disabled' },
    output_config: { effort: 'low' },
    system:
      `You write short, factual fantasy football trade evaluations. Use only the numbers given to you. Never invent stats, injuries, team needs, or league context that was not provided. Three to five sentences. ${hasSeasonPoints ? 'The computed value already blends ADP with real season-to-date points-per-game where available — explain using both numbers for a player that has real points, not just ADP.' : ''} ${hasNotes ? "The manager also left notes on this league — weave them in only where actually relevant, and never let them override or contradict the computed verdict." : ''} ${toneInstruction(input.mode)}`,
    messages: [
      {
        role: 'user',
        content: `A manager is considering trading away ${describe(input.give)} to receive ${describe(input.receive)}. Based on this value (ADP, blended with real season-to-date points-per-game where a player has enough games played), this trade nets a ${input.netValue >= 0 ? '+' : ''}${input.netValue} point swing in the manager's favor, and the computed verdict is "${input.verdict}". Explain why, based only on these numbers.${hasNotes ? ` The manager's notes on this league: ${input.leagueNotes!.map((n) => `"${n}"`).join(', ')}` : ''}`,
      },
    ],
  })

  const textBlock = message.content.find((b) => b.type === 'text')
  if (!textBlock || textBlock.type !== 'text') {
    throw new ClaudeAPIError('Claude returned no text content')
  }
  return textBlock.text.trim()
}

interface AskCopilotReasoningInput {
  askText: string
  anchor: { name: string; position: string; adp: number }
  candidates: Array<{ name: string; position: string; adp: number; teamName: string }>
  mode: Mode
}

// T-142: same split as every other generate* here — the candidate-finder
// (app/api/notes/ask-copilot/route.ts) has already found real players on
// real rosters in this exact league before Claude ever sees them. Claude
// only explains why these specific, already-found players fit the ask; it
// is never the thing deciding who the candidates are.
export async function generateAskCopilotReasoning(input: AskCopilotReasoningInput): Promise<string> {
  const describeCandidate = (c: AskCopilotReasoningInput['candidates'][number]) =>
    `${c.name} (${c.position}, ADP ${Math.round(c.adp)}, rostered by ${c.teamName})`

  const message = await createMessage({
    model: MODEL,
    max_tokens: 300,
    thinking: { type: 'disabled' },
    output_config: { effort: 'low' },
    system:
      `You write short, factual fantasy football trade-candidate explanations. A manager asked a question about trading a specific player; a deterministic system already searched their real league rosters and found the candidates listed below by comparable ADP-implied value at the requested position — you are only explaining why these already-found players are reasonable trade targets, never suggesting a player that isn't in the list. Use only the ADP numbers and names given to you. Never invent stats, injuries, team needs, or league context that was not provided. Three to five sentences. ${toneInstruction(input.mode)}`,
    messages: [
      {
        role: 'user',
        content: `The manager asked: "${input.askText}". The player they're trading away is ${input.anchor.name} (${input.anchor.position}, ADP ${Math.round(input.anchor.adp)}). Real candidates found in their league, matched by comparable ADP-implied value at the target position: ${input.candidates.map(describeCandidate).join('; ')}. Explain why each is a reasonable target based only on these ADP numbers.`,
      },
    ],
  })

  const textBlock = message.content.find((b) => b.type === 'text')
  if (!textBlock || textBlock.type !== 'text') {
    throw new ClaudeAPIError('Claude returned no text content')
  }
  return textBlock.text.trim()
}

interface DraftRecommendationCandidate {
  playerId: string
  name: string
  position: string
  adp: number
  // The exact signals computeBestAvailable (lib/draftBoard.ts) already used
  // to rank this candidate — passed through so Claude explains the real
  // reason a player is here instead of reconstructing a plausible-sounding
  // guess from ADP and a one-line strategy description alone.
  isNeeded: boolean
  strategyWeight: number
  // Separate from strategyWeight — a real single-QB-league ADP correction
  // (Sleeper's search_rank proxy skews QB up sharply because it reflects
  // Sleeper-wide search popularity, including its large superflex/2QB
  // dynasty population), not something "the stated strategy" did. Kept
  // distinct so Claude never misattributes it.
  formatWeight: number
}

export interface DraftPickRecommendation {
  playerId: string
  reasoning: string
}

interface DraftRecommendationsInput {
  candidates: DraftRecommendationCandidate[]
  round: number
  pickNumber: number
  strategy: DraftStrategy
  rosterSoFar: Array<{ name: string; position: string }>
  mode: Mode
}

const RECOMMENDATION_SCHEMA = {
  type: 'object',
  properties: {
    recommendations: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          playerId: { type: 'string' },
          reasoning: { type: 'string' },
        },
        required: ['playerId', 'reasoning'],
        additionalProperties: false,
      },
    },
  },
  required: ['recommendations'],
  additionalProperties: false,
} as const

// T-64.1: called ~2-3 picks before the manager's turn (pre-fetch, never
// during the live clock — see PRD 6.3.1). Candidates and their ADP are
// already the deterministic best-available-by-need list computed by
// lib/draftBoard.ts; Claude only writes why each one fits right now.
export async function generateDraftPickRecommendations(
  input: DraftRecommendationsInput
): Promise<DraftPickRecommendation[]> {
  const isBalanced = input.strategy === 'balanced'
  // Per-candidate need/strategy/format notes, not just ADP — this is what
  // makes the reasoning "why THIS pick, THIS round, under YOUR strategy and
  // YOUR league's format" instead of a generic "good value" blurb that
  // happens to name-drop the strategy. The format note is independent of
  // strategy (applies even when Balanced, which has no rules of its own)
  // and is deliberately worded so Claude attributes it to the league
  // format, never to "the stated strategy."
  const candidateList = input.candidates
    .map((c) => {
      const needNote = c.isNeeded ? 'fills an open roster need' : 'not currently a roster need'
      const formatNote = c.formatWeight < 0 ? 'single-QB league format reduces early QB value here, independent of strategy' : null
      const weightNote = isBalanced
        ? null
        : c.strategyWeight > 0
          ? `boosted +${c.strategyWeight} this round by the stated strategy`
          : c.strategyWeight < 0
            ? `deprioritized ${c.strategyWeight} this round by the stated strategy`
            : 'strategy-neutral this round'
      const notes = [needNote, weightNote, formatNote].filter((n): n is string => n !== null).join('; ')
      return `- ${c.name} (${c.position}, ADP ${Math.round(c.adp)}, id: ${c.playerId}) — ${notes}`
    })
    .join('\n')
  const rosterList = input.rosterSoFar.length > 0
    ? input.rosterSoFar.map((p) => `${p.name} (${p.position})`).join(', ')
    : 'no picks yet'
  const strategyContext =
    input.strategy === 'balanced'
      ? null
      : `The manager is drafting a "${input.strategy}" strategy this draft: ${STRATEGY_DESCRIPTIONS[input.strategy]}`

  const message = await createMessage({
    model: MODEL,
    max_tokens: 700,
    thinking: { type: 'disabled' },
    output_config: {
      effort: 'low',
      format: { type: 'json_schema', schema: RECOMMENDATION_SCHEMA },
    },
    system:
      `You write short, factual fantasy football draft pick explanations. Use only the ADP numbers, positions, roster, and need/strategy/format notes given to you. Never invent stats, injuries, or team needs that were not provided. Ground each explanation in the exact notes given for that candidate — don't reconstruct a different-sounding rationale, and never attribute a "single-QB league format" note to the drafter's chosen strategy; they are separate things. One to two sentences per player. ${toneInstruction(input.mode)}`,
    messages: [
      {
        role: 'user',
        content: `It is round ${input.round}, pick ${input.pickNumber} of a live snake draft. The manager's roster so far: ${rosterList}.${strategyContext ? ` ${strategyContext}.` : ''} Here are the best available candidates for their next pick, each with its actual roster-need, draft-strategy, and league-format signal already computed:\n${candidateList}\n\nFor each candidate, explain in 1-2 sentences why they might be the pick — use their ADP relative to the other candidates, and the exact notes given for them${strategyContext ? ' (tie strategy notes explicitly back to the stated strategy, e.g. why a deprioritized position is still worth considering, or why a boosted one is a strong fit right now)' : ''}. If a candidate has a format note (e.g. single-QB league reducing early QB value), explain that as a league-format fact, not a strategy choice.`,
      },
    ],
  })

  const textBlock = message.content.find((b) => b.type === 'text')
  if (!textBlock || textBlock.type !== 'text') {
    throw new ClaudeAPIError('Claude returned no text content')
  }

  let parsed: { recommendations: DraftPickRecommendation[] }
  try {
    parsed = JSON.parse(textBlock.text)
  } catch {
    throw new ClaudeAPIError('Claude returned malformed JSON for draft recommendations')
  }
  return parsed.recommendations
}

interface FilmRoomRecapInput {
  leagueName: string
  won: boolean | null
  myScore: number
  opponentScore: number
  usageSignal: { name: string; position: string | null; direction: 'buy_low' | 'sell_high'; deltaPct: number } | null
  mode: Mode
}

// T-95: the win/loss, score, and usage signal are all computed
// deterministically before this is called (lib/filmRoomSignals.ts,
// app/api/film-room/route.ts) — Claude only narrates them. Non-punitive
// framing on a loss is instructed directly (PRD Section 7 / 6.13's
// "quietest palette" — Film Room reviews, it doesn't punish).
export async function generateFilmRoomRecap(input: FilmRoomRecapInput): Promise<string> {
  const resultLine =
    input.won === true
      ? `Won ${input.myScore} to ${input.opponentScore}.`
      : input.won === false
        ? `Lost ${input.myScore} to ${input.opponentScore}.`
        : `Tied ${input.myScore} to ${input.opponentScore}.`

  const signalLine = input.usageSignal
    ? input.usageSignal.direction === 'buy_low'
      ? `${input.usageSignal.name} (${input.usageSignal.position})'s snap share rose ${input.usageSignal.deltaPct} points week over week.`
      : `${input.usageSignal.name} (${input.usageSignal.position})'s snap share fell ${input.usageSignal.deltaPct} points week over week.`
    : null

  const message = await createMessage({
    model: MODEL,
    max_tokens: 150,
    thinking: { type: 'disabled' },
    output_config: { effort: 'low' },
    system:
      `You write short, factual weekly fantasy football recaps. Use only the result and usage numbers given to you. Never invent stats, injuries, or plays that were not provided. A loss is reviewed the same even-handed way a win is — never scold, mock, or pile on. One to two sentences. ${toneInstruction(input.mode)}`,
    messages: [
      {
        role: 'user',
        content: `League: ${input.leagueName}. ${resultLine}${signalLine ? ` ${signalLine}` : ''} Write a brief recap of the week.`,
      },
    ],
  })

  const textBlock = message.content.find((b) => b.type === 'text')
  if (!textBlock || textBlock.type !== 'text') {
    throw new ClaudeAPIError('Claude returned no text content')
  }
  return textBlock.text.trim()
}

interface PlayerNewsContextInput {
  playerName: string
  playerPosition: string
  headline: string
  summary: string | null
  mode: Mode
}

// T-95 follow-up: generated once per (player x news item) and cached in
// player_context_cache (lib/pulse.ts), reused for every user who rosters
// that player — never a per-user call. Explicitly allowed to decline: a
// real ESPN item this session matched a rostered player purely through an
// off-field lifestyle story (a wedding announcement) with zero fantasy
// implication — rather than manufacturing relevance, Claude is instructed
// to say so, and the caller treats null as "don't surface this."
export async function generatePlayerNewsContext(input: PlayerNewsContextInput): Promise<string | null> {
  const message = await createMessage({
    model: MODEL,
    max_tokens: 150,
    thinking: { type: 'disabled' },
    output_config: { effort: 'low' },
    system:
      `You write one short, factual sentence explaining why a piece of NFL news matters for a fantasy football manager who rosters the player mentioned. Use only the headline and summary given to you — never invent stats, injuries, or context not provided. If the news has no real fantasy implication (a lifestyle story, an award, an off-field event with no bearing on availability, role, or workload), respond with exactly the single word NONE and nothing else. ${toneInstruction(input.mode)}`,
    messages: [
      {
        role: 'user',
        content: `Player: ${input.playerName} (${input.playerPosition}). Headline: "${input.headline}"${input.summary ? `\nSummary: "${input.summary}"` : ''}\n\nWrite one sentence on why this matters for a manager who rosters this player, or respond NONE if it doesn't.`,
      },
    ],
  })

  const textBlock = message.content.find((b) => b.type === 'text')
  if (!textBlock || textBlock.type !== 'text') {
    throw new ClaudeAPIError('Claude returned no text content')
  }
  const text = textBlock.text.trim()
  if (/^none\.?$/i.test(text)) return null
  return text
}

interface OpportunitySurgeContextInput {
  outgoingName: string
  outgoingStatus: string
  beneficiaryName: string
  beneficiaryPosition: string
  nflTeam: string
  mode: Mode
  // T-143: a general note (T-141) the manager left on this exact player —
  // extra context only, never a replacement for the real depth-chart
  // signal above. Only ever set for the one user who wrote it (see
  // lib/pulse.ts's getOrGenerateSurgeReasoning — a note bypasses the
  // shared reasoning cache so it's never leaked into another user's card).
  userNote?: string
}

// T-99: the outgoing/beneficiary pairing itself is fully deterministic
// (lib/opportunitySurge.ts, real NFL depth chart data) — Claude only
// writes the one sentence explaining why it matters, same split as every
// other reasoning function in this file. Cached once per event, same as
// generatePlayerNewsContext above.
export async function generateOpportunitySurgeContext(input: OpportunitySurgeContextInput): Promise<string> {
  const message = await createMessage({
    model: MODEL,
    max_tokens: 150,
    thinking: { type: 'disabled' },
    output_config: { effort: 'low' },
    system:
      `You write one short, factual sentence explaining a fantasy football opportunity: a starter is sidelined and a teammate is next in line for their role. Use only the names, status, position, and team given to you — never invent snap counts, stats, or timelines not provided. ${input.userNote ? "The manager also left a note about this player — weave it in only if it's actually relevant to this opportunity, and never let it override or contradict the real depth-chart signal." : ''} ${toneInstruction(input.mode)}`,
    messages: [
      {
        role: 'user',
        content: `${input.outgoingName} is listed as ${input.outgoingStatus} for the ${input.nflTeam}. ${input.beneficiaryName} (${input.beneficiaryPosition}) is next on the team's real depth chart at that spot.${input.userNote ? ` The manager's note on ${input.beneficiaryName}: "${input.userNote}"` : ''} Write one sentence on why this makes ${input.beneficiaryName} worth a look.`,
      },
    ],
  })

  const textBlock = message.content.find((b) => b.type === 'text')
  if (!textBlock || textBlock.type !== 'text') {
    throw new ClaudeAPIError('Claude returned no text content')
  }
  return textBlock.text.trim()
}

interface WindowRecapInput {
  leagueResults: { leagueName: string; myScore: number; opponentScore: number }[]
  playerHighlights: { name: string; eventType: 'touchdown' | 'reception' | 'yardage' | 'negative'; points: number }[]
  hasMoreWindowsToday: boolean
  mode: Mode
}

// T-111: LIVE tab's window recap — the scores, matchup deltas, and player
// events are all already computed deterministically (lib/windowRecap.ts)
// before this is ever called; Claude only narrates them, same split as
// every other reasoning function in this file. The one instruction that
// matters most: if there's a later window still to come today, say so —
// never imply a matchup is decided when the games that would decide it
// haven't happened yet.
export async function generateWindowRecap(input: WindowRecapInput): Promise<string> {
  const leagueLines = input.leagueResults
    .map((l) => `${l.leagueName}: you ${l.myScore >= l.opponentScore ? 'lead' : 'trail'} ${l.myScore}-${l.opponentScore}`)
    .join('; ')
  const highlightLines = input.playerHighlights
    .map((h) => `${h.name} (${h.eventType}, ${h.points >= 0 ? '+' : ''}${h.points.toFixed(1)} pts)`)
    .join(', ')

  const message = await createMessage({
    model: MODEL,
    max_tokens: 200,
    thinking: { type: 'disabled' },
    output_config: { effort: 'low' },
    system:
      `You write a short, factual recap of a completed window of NFL games for a fantasy manager. Use only the league scores and player events given to you — never invent stats, plays, or outcomes not provided. ${input.hasMoreWindowsToday ? 'Later games today still affect these matchups — never imply a matchup is decided or final.' : 'This is the last window today — these are the final matchup results.'} Two to three sentences. ${toneInstruction(input.mode)}`,
    messages: [
      {
        role: 'user',
        content: `Matchup status: ${leagueLines || 'no active matchups'}. Notable player events this window: ${highlightLines || 'none'}. Write the recap.`,
      },
    ],
  })

  const recapTextBlock = message.content.find((b) => b.type === 'text')
  if (!recapTextBlock || recapTextBlock.type !== 'text') {
    throw new ClaudeAPIError('Claude returned no text content')
  }
  return recapTextBlock.text.trim()
}
