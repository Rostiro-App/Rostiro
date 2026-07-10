import type { FC } from 'react'
import { StandardState } from '@/app/demo/components/StandardState'

export type StudioStateKind = 'standard' | 'waiver_day' | 'film_room' // 'draft' future; game_day handled specially

export interface StatePack<T> {
  state: StudioStateKind
  label: string
  defaultContent: () => T
  prefill: () => T
  AuthorForm: FC<{ content: T; onChange: (c: T) => void }>
  FullSurface: FC<{ content: T }>
  FocalCard: FC<{ content: T }>
}

// Standard is a pass-through of the existing feed (no authored content in Phase 2).
const StandardFull: FC<{ content: null }> = () => <StandardState />
const StandardFocal: FC<{ content: null }> = () => <StandardState />
const StandardForm: FC<{ content: null; onChange: (c: null) => void }> = () => (
  <p className="mono-data text-[11px]" style={{ color: 'var(--t3)' }}>Standard feed — no authored content in this pack.</p>
)

const standardPack: StatePack<null> = {
  state: 'standard', label: 'Standard',
  defaultContent: () => null, prefill: () => null,
  AuthorForm: StandardForm, FullSurface: StandardFull, FocalCard: StandardFocal,
}

export const SURFACE_PACKS: Partial<Record<StudioStateKind, StatePack<any>>> = {
  standard: standardPack,
}
