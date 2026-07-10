'use client'
import { SceneStage } from './SceneStage'
import { DemoShell } from '@/app/demo/components/DemoShell'
import { StandardState } from '@/app/demo/components/StandardState'

const DURATION = 300 // 10s @ 30fps
const SWEEP_START = 150
const SWEEP_END = 204 // ~1800ms @ 30fps

export function KickoffScene({ frame }: { frame?: number } = {}) {
  return (
    <SceneStage durationFrames={DURATION} caption="The whole OS shifts at kickoff — interactive demo." staticFrame={260} frame={frame}>
      {(f) => {
        const gameDay = f >= SWEEP_START
        const sweeping = f >= SWEEP_START && f < SWEEP_END
        return (
          <DemoShell variant="contained" stateOverride={gameDay ? 'game_day' : 'standard'} sweeping={sweeping}>
            <StandardState missionControl={gameDay} sweeping={sweeping} />
          </DemoShell>
        )
      }}
    </SceneStage>
  )
}
