import { computeInjectionImpact } from './crossLeagueImpact'
import type { InterruptMetricRow } from '@/components/interrupt/InterruptCardView'

export type SimEventKind = 'interrupt'  // Phase 1. Future: 'roster_exposure', ...
export type SimMetricRow = InterruptMetricRow

export interface InterruptSimEvent {
  kind: 'interrupt'
  eventLabel: string            // freeform: 'TOUCHDOWN' | '66-YARD BOMB' | ...
  playerLine: string            // 'Amon-Ra St. Brown · WR · DET' — editable
  points: number | null
  metrics: SimMetricRow[]
  autoDismissMs: number | null  // 7000 default; null = hold for filming
}

export function defaultInterruptEvent(): InterruptSimEvent {
  return { kind: 'interrupt', eventLabel: 'TOUCHDOWN', playerLine: '', points: 6, metrics: [], autoDismissMs: 7000 }
}

/** Hybrid prefill: real winProb deltas as editable metric rows. */
export function prefillInterruptMetrics(playerId: string, points: number): SimMetricRow[] {
  return computeInjectionImpact(playerId, points).map((i) => ({
    leagueName: i.leagueName,
    label: 'Win Prob',
    value: `${i.deltaPct >= 0 ? '+' : ''}${i.deltaPct}%`,
    deltaPositive: i.deltaPct >= 0,
  }))
}
