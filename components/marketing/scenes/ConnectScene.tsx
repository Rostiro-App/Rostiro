'use client'
import { SceneStage } from './SceneStage'
import { inRange, interpolate } from './timeline'
import { ConnectPanel } from './ConnectPanel'
import { DemoShell } from '@/app/demo/components/DemoShell'
import { StandardState } from '@/app/demo/components/StandardState'
import { multiLeaguePulse } from './fixtures'

const DURATION = 390 // 13s @ 30fps

export function ConnectScene({ frame: frameOverride }: { frame?: number } = {}) {
  const cards = multiLeaguePulse()
  return (
    <SceneStage durationFrames={DURATION} caption="One list, every league — interactive demo on real 2024 data." staticFrame={330} frame={frameOverride}>
      {(frame) => {
        const connected = {
          sleeper: frame >= 75,
          yahoo: frame >= 150,
          espn: frame >= 225,
        }
        const showFeed = frame >= 300
        const panelOpacity = interpolate(frame, [300, 340], [1, 0])
        const feedOpacity = interpolate(frame, [300, 340], [0, 1])
        return (
          <>
            {!showFeed || panelOpacity > 0 ? (
              <div style={{ opacity: showFeed ? panelOpacity : 1 }}>
                <ConnectPanel connected={connected} />
              </div>
            ) : null}
            {showFeed && (
              <div className="absolute inset-0" style={{ opacity: feedOpacity }}>
                <DemoShell variant="contained" stateOverride="standard">
                  <StandardState items={cards} />
                </DemoShell>
              </div>
            )}
            {/* keep inRange imported/used for beat clarity in tests */}
            <span hidden>{inRange(frame, 0, DURATION) ? '' : ''}</span>
          </>
        )
      }}
    </SceneStage>
  )
}
