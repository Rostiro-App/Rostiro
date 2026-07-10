'use client'
import { DemoShell } from '@/app/demo/components/DemoShell'
import { StandardState } from '@/app/demo/components/StandardState'
import { InterruptCardView } from '@/components/interrupt/InterruptCardView'
import type { InterruptSimEvent } from '../lib/simEvents'
import { SURFACE_PACKS, type StudioStateKind } from '../lib/studioPacks'
import { LiveScene } from './live/LiveScene'
import type { LiveScenario } from '@/app/demo/lib/liveScenario'
import type { RostiroState } from '@/types'

type CanvasState = StudioStateKind | 'game_day' | 'live'

export function StudioCanvas({ state = 'game_day', aspect, event, leaving, content }: {
  state?: CanvasState
  aspect: '16:9' | '9:16'
  event?: InterruptSimEvent | null
  leaving?: boolean
  content?: unknown
}) {
  if (state === 'live') {
    return <LiveScene scenario={content as LiveScenario} aspect={aspect} />
  }

  const pack = state !== 'game_day' ? SURFACE_PACKS[state] : undefined
  const stateOverride: RostiroState = state === 'game_day' ? 'game_day' : (state as RostiroState)

  return (
    <div className="relative w-full mx-auto" style={{ aspectRatio: aspect === '16:9' ? '16 / 9' : '9 / 16', maxWidth: aspect === '16:9' ? '100%' : 480 }}>
      <div className="glass-heavy rounded-2xl overflow-hidden absolute inset-0" style={{ border: '1px solid var(--hairline-bright)' }}>
        {state === 'game_day' ? (
          <>
            <DemoShell variant="contained" stateOverride="game_day"><StandardState missionControl /></DemoShell>
            {event && (
              <InterruptCardView contained leaving={leaving} typeLabel={event.eventLabel} headline={event.playerLine}
                reasoning={event.points != null ? `+${event.points} to your live score` : ''} color="var(--crit)" priority="info" metrics={event.metrics} />
            )}
          </>
        ) : pack && aspect === '16:9' ? (
          <DemoShell variant="contained" stateOverride={stateOverride}><pack.FullSurface content={content} /></DemoShell>
        ) : pack ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <DemoShell variant="contained" stateOverride={stateOverride}><span /></DemoShell>
            <div className="absolute inset-0 flex items-center justify-center" style={{ background: 'rgba(3,7,13,.35)' }}>
              <pack.FocalCard content={content} />
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}
