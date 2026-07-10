'use client'
import { DemoShell } from '@/app/demo/components/DemoShell'
import { StandardState } from '@/app/demo/components/StandardState'
import { InterruptCardView } from '@/components/interrupt/InterruptCardView'
import type { InterruptSimEvent } from '../lib/simEvents'

export function StudioCanvas({ event, aspect, leaving }: { event: InterruptSimEvent | null; aspect: '16:9' | '9:16'; leaving?: boolean }) {
  return (
    <div className="relative w-full mx-auto" style={{ aspectRatio: aspect === '16:9' ? '16 / 9' : '9 / 16', maxWidth: aspect === '16:9' ? '100%' : 480 }}>
      <div className="glass-heavy rounded-2xl overflow-hidden absolute inset-0" style={{ border: '1px solid var(--hairline-bright)' }}>
        <DemoShell variant="contained" stateOverride="game_day">
          <StandardState missionControl />
        </DemoShell>
        {event && (
          <InterruptCardView
            contained
            leaving={leaving}
            typeLabel={event.eventLabel}
            headline={event.playerLine}
            reasoning={event.points != null ? `+${event.points} to your live score` : ''}
            color="var(--crit)"
            priority="info"
            metrics={event.metrics}
          />
        )}
      </div>
    </div>
  )
}
