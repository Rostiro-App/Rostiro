'use client'
import { SceneStage } from '@/components/marketing/scenes/SceneStage'
import { DemoShell } from '@/app/demo/components/DemoShell'
import { StandardState } from '@/app/demo/components/StandardState'
import { LiveCompanion } from './LiveCompanion'
import { liveSimAt } from '@/app/demo/lib/liveSim'
import type { LiveScenario } from '@/app/demo/lib/liveScenario'

const DURATION = 750
const SWEEP_START = 90, SWEEP_END = 144, OPEN_END = 240

export function LiveScene({ scenario, aspect, frame }: { scenario: LiveScenario; aspect: '16:9' | '9:16'; frame?: number }) {
  return (
    <SceneStage durationFrames={DURATION} caption="Rostiro LIVE — your second-screen companion." staticFrame={500} frame={frame}>
      {(f) => {
        const sweeping = f >= SWEEP_START && f < SWEEP_END
        const live = f >= OPEN_END
        const t = live ? Math.min(1, (f - OPEN_END) / (DURATION - OPEN_END - 60)) : 0
        return (
          <DemoShell variant="contained" stateOverride="game_day" sweeping={sweeping}>
            {live
              ? <LiveCompanion frame={liveSimAt(t, scenario)} />
              : <StandardState missionControl sweeping={sweeping} />}
          </DemoShell>
        )
      }}
    </SceneStage>
  )
}
