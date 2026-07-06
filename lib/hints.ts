// T-72: coach-mark registry — skippable, per PRD 6.8's original spec
// (founder confirmed July 6, 2026: no mandatory tour, "don't want to churn
// people"). One `<Hint>` anchored to each crucial instrument; shown one at
// a time, in this order, the first time each anchor is actually on screen
// — not all on day one. Dismissed-forever state lives on `users.seen_hints`
// (jsonb), "replay tour" resets it.

export interface HintDef {
  id: string
  title: string
  body: string
  placement: 'bottom' | 'bottom-end' | 'top'
}

export const HINTS: HintDef[] = [
  {
    id: 'mode-chip',
    title: 'Your Mode',
    body: 'Focused, Balanced, or Savant — how much detail you see, everywhere in the app. Tap to change it anytime.',
    placement: 'bottom-end',
  },
  {
    id: 'command-palette',
    title: 'Command Palette',
    body: '⌘K from anywhere — jump straight to a league, a player, or an action without hunting through menus.',
    placement: 'bottom-end',
  },
  {
    id: 'system-bar-health',
    title: 'League Health',
    body: 'These dots are your leagues at a glance — green is healthy. Hover one for the real score behind it.',
    placement: 'bottom',
  },
  {
    id: 'pulse-actions',
    title: 'Done or Snooze',
    body: 'Done clears a decision for good. Snooze bumps it to tomorrow. Every Pulse item, one tap either way.',
    placement: 'top',
  },
  {
    id: 'ticker',
    title: 'The Ticker',
    body: 'Live scores and season updates, always scrolling, always current — the pulse of the whole league week.',
    placement: 'top',
  },
]

export const ALL_HINT_IDS = HINTS.map((h) => h.id)
