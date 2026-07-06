import { AbsoluteFill, interpolate, interpolateColors, useCurrentFrame } from 'remotion'
import { loadFont } from '@remotion/google-fonts/Inter'
import { COLORS, STATE_COLOR } from '../tokens'
import { AppFrame } from '../components/AppFrame'
import { Callout } from '../components/Callout'
import { cameraStyle } from '../components/camera'

const { fontFamily } = loadFont()

// Recreates PRD 6.10's kickoff-triggered transition inside the real app
// shell (dock + System Bar), not floating in empty space: at the first live
// game of the day, the System Bar accent and Pulse header sweep from
// Standard's resting blue to Game Day's cockpit red over 800ms (brand kit
// v1.0 §4: "Never an instant swap"), then the header re-labels to "Mission
// Control" and live ticker items slide in. A slow camera push toward the
// header sells the moment instead of a flat static wide shot; a callout
// names what just happened for a silent clip with no voiceover.

const FPS = 30
const SWEEP_START = 4 * FPS
const SWEEP_FRAMES = Math.round(0.8 * FPS) // 800ms, matches STATE_TRANSITION_MS
const SWEEP_END = SWEEP_START + SWEEP_FRAMES

const TICKER_ITEMS = [
  { team: 'BUF @ KC', detail: 'Q2 7:41 · 14-10' },
  { team: 'SF @ DAL', detail: 'Q1 11:20 · 3-0' },
  { team: 'PHI @ MIA', detail: 'Q2 2:05 · 17-14' },
]

const RESTING_CARDS = [
  { tag: 'REVIEW', color: COLORS.signal, text: 'Trade pending: your Kupp for their Ekeler. Lean accept.' },
  { tag: 'WATCH', color: COLORS.textMuted, text: 'Joe Mixon is questionable. Pivot option ready: Zach Moss.' },
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
          <div style={{ position: 'relative', width: '100%', height: '100%', fontFamily, padding: '44px 48px' }}>
            <span style={{ color: accent, fontSize: 20, letterSpacing: 3, fontWeight: 700 }}>{headerLabel}</span>
            <h1
              style={{
                color: COLORS.textPrimary,
                fontSize: 46,
                fontWeight: 700,
                marginTop: 14,
                opacity: flicker,
                maxWidth: 900,
              }}
            >
              {isGameDay ? 'Every live game touching your rosters.' : 'Good morning. 5 decisions across 3 leagues.'}
            </h1>

            {/* Resting cards behind the header, so the scene reads as a real
                populated dashboard, not an empty stage for one headline. */}
            <div style={{ marginTop: 36, display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 760 }}>
              {RESTING_CARDS.map((c) => (
                <div
                  key={c.tag}
                  style={{
                    padding: '18px 22px',
                    borderRadius: 12,
                    backgroundColor: COLORS.navyCard,
                    borderLeft: `3px solid ${c.color}`,
                    opacity: 0.85,
                  }}
                >
                  <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: 1.5, color: c.color }}>{c.tag}</span>
                  <div style={{ color: COLORS.textPrimary, fontSize: 18, marginTop: 6 }}>{c.text}</div>
                </div>
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

            {/* Ticker strip: live score items slide in after the sweep completes.
                Fixed pixel offset from the content area's own top-left, not
                bottom:0 — a scale() transform on an ancestor (the camera
                push) does not itself break flex height propagation, but
                nesting bottom:0 three flex levels deep inside it proved
                fragile in practice, so an explicit offset is more reliable. */}
            <div style={{ position: 'absolute', left: 0, right: 0, top: 900 }}>
              <div
                style={{
                  display: 'flex',
                  gap: 20,
                  padding: '24px 48px 0',
                  borderTop: `1px solid ${COLORS.hairline}`,
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
                        padding: '14px 20px',
                        borderRadius: 10,
                        border: `1px solid ${COLORS.hairlineBright}`,
                        color: COLORS.textPrimary,
                        fontSize: 17,
                      }}
                    >
                      <div style={{ fontWeight: 700 }}>{item.team}</div>
                      <div style={{ color: COLORS.textMuted, fontSize: 14, marginTop: 3 }}>{item.detail}</div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </AppFrame>
      </div>
    </AbsoluteFill>
  )
}
