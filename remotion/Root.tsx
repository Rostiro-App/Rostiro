import { Composition } from 'remotion'
import { KickoffTransition } from './compositions/KickoffTransition'
import { InterruptStackReveal } from './compositions/InterruptStackReveal'
import { MultiLeagueConnectReenactment } from './compositions/MultiLeagueConnectReenactment'

const FPS = 30
const WIDTH = 1920
const HEIGHT = 1080

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="KickoffTransition"
        component={KickoffTransition}
        durationInFrames={15 * FPS}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
      />
      <Composition
        id="InterruptStackReveal"
        component={InterruptStackReveal}
        durationInFrames={14 * FPS}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
      />
      <Composition
        id="MultiLeagueConnectReenactment"
        component={MultiLeagueConnectReenactment}
        durationInFrames={16 * FPS}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
      />
    </>
  )
}
