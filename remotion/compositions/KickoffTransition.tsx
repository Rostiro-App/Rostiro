import { AbsoluteFill, interpolate, interpolateColors, useCurrentFrame } from 'remotion'
import { loadFont } from '@remotion/google-fonts/Inter'
import { COLORS, STATE_COLOR } from '../tokens'
import { AppFrame } from '../components/AppFrame'
import { PulseCardMock } from '../components/PulseCardMock'
import { Callout } from '../components/Callout'
import { cameraStyle } from '../components/camera'

const { fontFamily } = loadFont()

// Recreates PRD 6.10's kickoff-triggered transition inside the real app
// shell (dock + System Bar + bottom ticker, all from AppFrame), not
// floating in empty space: at the first live game of the day, the System
// Bar accent and Pulse header sweep from Standard's resting blue to Game
// Day's cockpit red over 800ms (brand kit v1.0 §4: "Never an instant
// swap"), the header re-labels to "Mission Control", and a real "Live Now"
// card (matching app/(dashboard)/pulse/page.tsx's actual markup) appears.
// Rebuilt 2026-07-06 after founder review against a real /pulse screenshot
// found the first pass's icons, header typography, and cards were all
// approximations rather than the real thing.

const FPS = 30
const SWEEP_START = 4 * FPS
const SWEEP_FRAMES = Math.round(0.8 * FPS) // 800ms, matches STATE_TRANSITION_MS
const SWEEP_END = SWEEP_START + SWEEP_FRAMES
const LIVE_NOW_AT = SWEEP_END + 15

const RESTING_CARDS = [
  {
    headline: 'Trade pending: your Kupp for their Ekeler',
    league: 'Dynasty Kings',
    platform: 'Sleeper',
    tag: 'REVIEW',
    tagColor: COLORS.signal,
    priorityColor: COLORS.signal,
    reasoning: 'Lean accept — it fixes your RB2 gap and Ekeler projects +3.1 over replacement this week.',
  },
  {
    headline: 'Joe Mixon is questionable',
    league: 'The League',
    platform: 'ESPN',
    tag: 'WATCH',
    tagColor: COLORS.textMuted,
    priorityColor: COLORS.textMuted,
    reasoning: 'Pivot option ready: Zach Moss, 14.2 projected if Mixon sits.',
  },
]

export const KickoffTransition: React.FC = () => {
  const frame = useCurrentFrame()

  const accent = interpolateColors(frame, [SWEEP_START, SWEEP_END], [STATE_COLOR.standard, STATE_COLOR.game_day])
  const isGameDay = frame >= SWEEP_END
  const headerLabel = frame < SWEEP_START + SWEEP_FRAMES / 2 ? 'PULSE' : 'MISSION CONTROL'
  const flicker = interpolate(frame, [SWEEP_END, SWEEP_END + 6, SWEEP_END + 12], [1, 0.3, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })
  const liveNowOpacity = interpolate(frame, [LIVE_NOW_AT, LIVE_NOW_AT + 14], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })

  const camera = cameraStyle(frame, [
    { frame: 0, scale: 1, originX: 50, originY: 12 },
    { frame: SWEEP_START - 20, scale: 1, originX: 50, originY: 12 },
    { frame: SWEEP_START + SWEEP_FRAMES + 20, scale: 1.1, originX: 50, originY: 12 },
    { frame: SWEEP_END + 130, scale: 1.1, originX: 50, originY: 12 },
    { frame: SWEEP_END + 170, scale: 1, originX: 50, originY: 12 },
  ])

  return (
    <AbsoluteFill style={{ overflow: 'hidden' }}>
      <div style={{ width: '100%', height: '100%', ...camera }}>
        <AppFrame state={isGameDay ? 'game_day' : 'standard'} modeLabel="BALANCED">
          <div style={{ position: 'relative', width: '100%', height: '100%', fontFamily, padding: '40px 48px' }}>
            <span style={{ color: accent, fontSize: 20, letterSpacing: 3, fontWeight: 700 }}>{headerLabel}</span>
            <h1
              style={{
                color: COLORS.textPrimary,
                fontSize: 32,
                fontWeight: 600,
                marginTop: 6,
                opacity: flicker,
                maxWidth: 900,
              }}
            >
              {isGameDay ? 'Every live game touching your rosters.' : 'Good morning. 5 decisions across 3 leagues.'}
            </h1>

            {/* Real Live Now card (app/(dashboard)/pulse/page.tsx lines
                384-419) — appears the moment Game Day activates, not a
                fabricated ticker reel. */}
            <div
              style={{
                marginTop: 20,
                opacity: liveNowOpacity,
                borderRadius: 12,
                padding: '14px 20px',
                backgroundColor: COLORS.navyCard,
                borderLeft: `3px solid ${STATE_COLOR.game_day}`,
                maxWidth: 760,
              }}
            >
              <span style={{ fontSize: 13, letterSpacing: 2, color: STATE_COLOR.game_day }}>LIVE NOW</span>
              <div style={{ marginTop: 6, color: COLORS.textPrimary, fontSize: 18 }}>BUF 14 – KC 10 · Q2 7:41</div>
              <div style={{ marginTop: 2, color: COLORS.textMuted, fontSize: 15 }}>Diggs, Allen (2 leagues)</div>
            </div>

            {/* Resting cards behind the header — real card anatomy
                (PulseCardMock), so this reads as a populated dashboard. */}
            <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 760 }}>
              {RESTING_CARDS.map((c) => (
                <PulseCardMock key={c.headline} {...c} opacity={0.9} />
              ))}
            </div>

            <Callout
              x={1180}
              y={230}
              side="below"
              width={440}
              appearAt={SWEEP_END + 20}
              holdFrames={130}
              text="The System Bar and Pulse header shift automatically the moment your first game kicks off — never a setting you toggle."
            />
          </div>
        </AppFrame>
      </div>
    </AbsoluteFill>
  )
}
