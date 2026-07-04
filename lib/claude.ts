// Claude API wrapper. Model is claude-sonnet-5 — the current Sonnet-tier
// model, same cost tier as the claude-sonnet-4-6 named in the PRD (which is
// now the previous generation). Thinking is disabled and effort is low: this
// wrapper is only ever asked for a short, factual explanation of numbers we
// already computed, not open-ended reasoning — keep it cheap and fast.

import Anthropic from '@anthropic-ai/sdk'
import { ClaudeAPIError, type DraftStrategy } from '@/types'
import { STRATEGY_DESCRIPTIONS } from '@/lib/draftBoard'
import type { Mode } from '@/components/nav/AppShell'

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
  const anthropic = getClient()

  let message
  try {
    message = await anthropic.messages.create({
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
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    throw new ClaudeAPIError(`Claude request failed: ${message}`)
  }

  const textBlock = message.content.find((b) => b.type === 'text')
  if (!textBlock || textBlock.type !== 'text') {
    throw new ClaudeAPIError('Claude returned no text content')
  }
  return textBlock.text.trim()
}

interface TradeReasoningInput {
  give: Array<{ name: string; position: string; adp: number }>
  receive: Array<{ name: string; position: string; adp: number }>
  verdict: 'win' | 'lose' | 'even'
  netValue: number
  mode: Mode
}

// Same split as generateStartSitReasoning: verdict and value are computed
// deterministically from ADP before this is called (see
// app/api/trades/analyze/route.ts) — Claude explains the numbers, it doesn't
// decide the trade.
export async function generateTradeReasoning(input: TradeReasoningInput): Promise<string> {
  const anthropic = getClient()

  const describe = (side: TradeReasoningInput['give']) =>
    side.map((p) => `${p.name} (${p.position}, ADP ${Math.round(p.adp)})`).join(', ')

  let message
  try {
    message = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 300,
      thinking: { type: 'disabled' },
      output_config: { effort: 'low' },
      system:
        `You write short, factual fantasy football trade evaluations. Use only the numbers given to you. Never invent stats, injuries, team needs, or league context that was not provided. Three to five sentences. ${toneInstruction(input.mode)}`,
      messages: [
        {
          role: 'user',
          content: `A manager is considering trading away ${describe(input.give)} to receive ${describe(input.receive)}. Based on ADP-implied value, this trade nets a ${input.netValue >= 0 ? '+' : ''}${input.netValue} point swing in the manager's favor, and the computed verdict is "${input.verdict}". Explain why, based only on these ADP numbers.`,
        },
      ],
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    throw new ClaudeAPIError(`Claude request failed: ${message}`)
  }

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
  const anthropic = getClient()

  const candidateList = input.candidates
    .map((c) => `- ${c.name} (${c.position}, ADP ${Math.round(c.adp)}, id: ${c.playerId})`)
    .join('\n')
  const rosterList = input.rosterSoFar.length > 0
    ? input.rosterSoFar.map((p) => `${p.name} (${p.position})`).join(', ')
    : 'no picks yet'
  const strategyContext =
    input.strategy === 'balanced'
      ? null
      : `The manager is drafting a "${input.strategy}" strategy this draft: ${STRATEGY_DESCRIPTIONS[input.strategy]}`

  let message
  try {
    message = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 700,
      thinking: { type: 'disabled' },
      output_config: {
        effort: 'low',
        format: { type: 'json_schema', schema: RECOMMENDATION_SCHEMA },
      },
      system:
        `You write short, factual fantasy football draft pick explanations. Use only the ADP numbers, positions, roster, and strategy given to you. Never invent stats, injuries, or team needs that were not provided. One to two sentences per player. ${toneInstruction(input.mode)}`,
      messages: [
        {
          role: 'user',
          content: `It is round ${input.round}, pick ${input.pickNumber} of a live snake draft. The manager's roster so far: ${rosterList}.${strategyContext ? ` ${strategyContext}.` : ''} Here are the best available candidates for their next pick:\n${candidateList}\n\nFor each candidate, explain in 1-2 sentences why they might be the pick, based on their ADP relative to the other candidates, how they fit the roster built so far${strategyContext ? ', and how they fit the stated draft strategy' : ''}.`,
        },
      ],
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    throw new ClaudeAPIError(`Claude request failed: ${message}`)
  }

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
  const anthropic = getClient()

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

  let message
  try {
    message = await anthropic.messages.create({
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
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    throw new ClaudeAPIError(`Claude request failed: ${message}`)
  }

  const textBlock = message.content.find((b) => b.type === 'text')
  if (!textBlock || textBlock.type !== 'text') {
    throw new ClaudeAPIError('Claude returned no text content')
  }
  return textBlock.text.trim()
}
