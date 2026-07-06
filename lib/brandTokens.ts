// Rostiro Brand Kit v1.0, Section 3 — pulse mark configuration per Rostiro
// State. Keyed against the exact RostiroState union from lib/rostiroState.ts
// ('draft' | 'standard' | 'waiver_day' | 'game_day' | 'film_room'), not the
// shorthand keys in rostiro-brand-kit.md (waiver/gameday/filmroom) — those
// don't match the engine's real output and would silently return undefined
// for 3 of 5 states if used as-is.

import type { RostiroState } from '@/lib/rostiroState'

export interface StateConfig {
  color: string
  amplitude: number // px deviation from center baseline
  cycleSec: number
  strokeWidth: number
  description: string
  activePeriod: string
  emotion: string
}

export const STATE_CONFIG: Record<RostiroState, StateConfig> = {
  draft: {
    // T-104: matches Waiver Day's green — founder confirmed (July 6, 2026)
    // both acquisition moments should read as the same "opportunity"
    // emotion, per 6.13's original spec (shipped amber never reconciled
    // with it until now).
    color: '#1D9E75', // opportunity green — shared with waiver_day
    amplitude: 11,
    cycleSec: 1.8,
    strokeWidth: 2.0,
    description: 'High, fast. Opportunistic, forward momentum.',
    activePeriod: 'Preseason through last draft completion',
    emotion: 'Hope, excitement — This is my year',
  },
  standard: {
    color: '#378ADD', // blue — matches primary UI accent
    amplitude: 7,
    cycleSec: 3.0,
    strokeWidth: 2.0,
    description: 'Medium, slow. Calm intelligence, monitoring.',
    activePeriod: 'Wednesday through Saturday (default/resting state)',
    emotion: 'Preparation, planning, optimization',
  },
  waiver_day: {
    color: '#1D9E75', // green
    amplitude: 10,
    cycleSec: 2.2,
    strokeWidth: 2.0,
    description: 'Medium-high, sharp peaks. Mission briefing energy.',
    activePeriod: 'Tuesday night / Wednesday AM (per-league cutoff)',
    emotion: 'Opportunity, urgency — Mission briefing',
  },
  game_day: {
    color: '#E24B4A', // red — matches the one destructive/critical accent (PRD 3)
    amplitude: 13, // maximum — jagged, volatile
    cycleSec: 1.2,
    strokeWidth: 2.2,
    description: 'Maximum amplitude, fastest cycle. Alive, urgent.',
    activePeriod: 'Thursday night, Sunday (full intensity), Monday night',
    emotion: 'Mission control — suspense, momentum, alive',
  },
  film_room: {
    color: '#7F77DD', // purple — also the Intelligence/Savant layer color
    amplitude: 5, // minimum — shallow, contemplative
    cycleSec: 4.0,
    strokeWidth: 2.0,
    description: 'Low amplitude, slowest cycle. Reflective, review mode.',
    activePeriod: 'Monday night through Tuesday AM',
    emotion: 'Review, analysis — What happened?',
  },
}

// Weeks 15-17 theming layer (PRD 6.10: "not an additional State" — a second
// polyline rendered over the active State's, dimmed to 0.5 opacity, per
// brand kit Section 3).
export const PLAYOFFS_OVERLAY = {
  color: '#F5C842', // championship gold
  strokeWidth: 1.5,
  strokeDasharray: '3,2',
  opacity: 1,
  dimActiveStateOpacityTo: 0.5,
} as const

export const STATE_TRANSITION_MS = 800
