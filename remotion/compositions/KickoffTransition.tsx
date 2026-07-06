import { AbsoluteFill, interpolate, interpolateColors, useCurrentFrame } from 'remotion'
import { loadFont } from '@remotion/google-fonts/Inter'
import { COLORS, STATE_COLOR } from '../tokens'

const { fontFamily } = loadFont()

// Recreates PRD 6.10's kickoff-triggered transition: at the first live game
// of the day, the System Bar accent and Pulse header sweep from Standard's
// resting blue to Game Day's cockpit red over 800ms (brand kit v1.0 §4:
// "Never an instant swap"), then the header re-labels to "Mission Control"
// and live ticker items slide in one at a time. Real product colors/timing
// (STATE_TRANSITION_MS, STATE_CONFIG), not invented values.

const FPS = 30
const SWEEP_START = 4 * FPS
const SWEEP_FRAMES = Math.round(0.8 * FPS) // 800ms, matches STATE_TRANSITION_MS
const SWEEP_END = SWEEP_START + SWEEP_FRAMES

const TICKER_ITEMS = [
  { team: 'BUF @ KC', detail: 'Q2 7:41 · 14-10' },
  { team: 'SF @ DAL', detail: 'Q1 11:20 · 3-0' },
  { team: 'PHI @ MIA', detail: 'Q2 2:05 · 17-14' },
]

export const KickoffTransition: React.FC = () => {
  const frame = useCurrentFrame()

  const accent = interpolateColors(frame, [SWEEP_START, SWEEP_END], [STATE_COLOR.standard, STATE_COLOR.game_day])
  const isGameDay = frame >= SWEEP_END
  const headerLabel = frame < SWEEP_START + SWEEP_FRAMES / 2 ? 'Pulse' : 'Mission Control'
  const flicker = interpolate(frame, [SWEEP_END, SWEEP_END + 6, SWEEP_END + 12], [1, 0.3, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })

  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.void, fontFamily }}>
      {/* System Bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '28px 56px',
          backgroundColor: COLORS.navyDark,
          borderBottom: `1px solid ${COLORS.hairline}`,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 12, height: 12, borderRadius: 999, backgroundColor: COLORS.live }} />
          <span style={{ color: COLORS.textDim, fontSize: 20, letterSpacing: 2, fontWeight: 500 }}>
            SYNCED 4S AGO
          </span>
        </div>
        <span
          style={{
            fontSize: 20,
            fontWeight: 700,
            letterSpacing: 3,
            padding: '8px 20px',
            borderRadius: 999,
            color: accent,
            border: `1.5px solid ${accent}`,
            transition: 'none',
          }}
        >
          {isGameDay ? 'GAME DAY' : 'STANDARD'}
        </span>
      </div>

      {/* Pulse / Mission Control header */}
      <div style={{ padding: '64px 56px 40px' }}>
        <span style={{ color: accent, fontSize: 22, letterSpacing: 3, fontWeight: 600 }}>
          {isGameDay ? 'MISSION CONTROL' : 'PULSE'}
        </span>
        <h1
          style={{
            color: COLORS.textPrimary,
            fontSize: 56,
            fontWeight: 700,
            marginTop: 16,
            opacity: flicker,
          }}
        >
          {isGameDay ? 'Every live game touching your rosters.' : 'Good morning. 5 decisions across 3 leagues.'}
        </h1>
      </div>

      {/* Ticker strip: live score items slide in after the sweep completes */}
      <AbsoluteFill style={{ top: 'auto', bottom: 0 }}>
        <div
          style={{
            display: 'flex',
            gap: 24,
            padding: '32px 56px',
            borderTop: `1px solid ${COLORS.hairline}`,
            backgroundColor: COLORS.navyCard,
          }}
        >
          {TICKER_ITEMS.map((item, i) => {
            const itemStart = SWEEP_END + 10 + i * 18
            const x = interpolate(frame, [itemStart, itemStart + 14], [60, 0], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
            })
            const opacity = interpolate(frame, [itemStart, itemStart + 14], [0, 1], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
            })
            return (
              <div
                key={item.team}
                style={{
                  transform: `translateX(${x}px)`,
                  opacity,
                  padding: '16px 24px',
                  borderRadius: 12,
                  border: `1px solid ${COLORS.hairlineBright}`,
                  color: COLORS.textPrimary,
                  fontSize: 20,
                }}
              >
                <div style={{ fontWeight: 700 }}>{item.team}</div>
                <div style={{ color: COLORS.textMuted, fontSize: 16, marginTop: 4 }}>{item.detail}</div>
              </div>
            )
          })}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  )
}
