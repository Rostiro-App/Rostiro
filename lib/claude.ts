// Claude API wrapper. Model is claude-sonnet-5 — the current Sonnet-tier
// model, same cost tier as the claude-sonnet-4-6 named in the PRD (which is
// now the previous generation). Thinking is disabled and effort is low: this
// wrapper is only ever asked for a short, factual explanation of numbers we
// already computed, not open-ended reasoning — keep it cheap and fast.

import Anthropic from '@anthropic-ai/sdk'
import { ClaudeAPIError, type DraftStrategy } from '@/types'
import { STRATEGY_DESCRIPTIONS } from '@/lib/draftBoard'

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

interface StartSitReasoningInput {
  starterName: string
  starterPosition: string
  starterAdp: number
  benchName: string
  benchPosition: string
  benchAdp: number
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
        'You write short, factual fantasy football lineup explanations. Use only the numbers given to you. Never invent stats, matchups, or injury information that was not provided. Two to three sentences, direct, no hedging filler.',
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
        'You write short, factual fantasy football trade evaluations. Use only the numbers given to you. Never invent stats, injuries, team needs, or league context that was not provided. Three to five sentences, direct, no hedging filler.',
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
        'You write short, factual fantasy football draft pick explanations. Use only the ADP numbers, positions, roster, and strategy given to you. Never invent stats, injuries, or team needs that were not provided. One to two sentences per player, direct, no hedging filler.',
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
