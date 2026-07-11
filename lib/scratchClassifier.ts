// T-163: deterministic scratch classifier. No network, no Claude — the news
// cron stays deterministic by design. Normalizes varied ESPN prose onto the
// Sleeper injury_status vocabulary (out/doubtful/questionable) so the card's
// injury:{lg}:{player}:{status} fingerprint reconciles instead of colliding.

export type ScratchStatus = 'out' | 'doubtful' | 'questionable'
export type ScratchConfidence = 'high' | 'medium'
export interface ScratchClassification { status: ScratchStatus; confidence: ScratchConfidence }

// Word-boundary matched, case-insensitive. Order matters: reversal first
// (a "now active" headline must not read as a scratch), then high, then medium.
const REVERSAL = [/\bwill play\b/, /\bexpected to play\b/, /\bupgraded\b/, /\bcleared\b/, /\bactivated\b/, /\bactive\b/]
const HIGH = [/\bruled out\b/, /\binactive\b/, /\bwill not play\b/, /\bwon['']?t play\b/, /\bdeclared out\b/, /\bdowngraded to out\b/, /\bout (?:for|indefinitely)\b/]
const DOUBTFUL = [/\bdoubtful\b/]
const QUESTIONABLE = [/\bquestionable\b/, /\bgame[- ]time decision\b/, /\blimited (?:in )?practice\b/, /\bdid not practice\b/, /\bdnp\b/, /\btrending toward\b/]

export function classifyScratch(headline: string, summary: string | null): ScratchClassification | null {
  const text = `${headline} ${summary ?? ''}`.toLowerCase()
  if (REVERSAL.some((re) => re.test(text)) && !HIGH.some((re) => re.test(text))) return null
  if (HIGH.some((re) => re.test(text))) return { status: 'out', confidence: 'high' }
  if (DOUBTFUL.some((re) => re.test(text))) return { status: 'doubtful', confidence: 'medium' }
  if (QUESTIONABLE.some((re) => re.test(text))) return { status: 'questionable', confidence: 'medium' }
  return null
}
