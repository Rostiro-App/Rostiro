import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion'
import { loadFont } from '@remotion/google-fonts/Inter'
import { COLORS } from '../tokens'
import { AppFrame } from '../components/AppFrame'
import { Callout } from '../components/Callout'
import { cameraStyle } from '../components/camera'

const { fontFamily } = loadFont()

// Recreates the real Interrupt Stack (components/InterruptStack.tsx) inside
// the real app shell during Game Day: one persistent slot, not a
// notification pile. A touchdown_swing event takes the slot, names exactly
// what happened, holds for the real 7-second AUTO_DISMISS_MS window, then
// clears itself on its own, unforced. The camera pushes in on the card as
// it lands, then pulls back out to the full dashboard once it clears,
// visually completing the idea that the app returns to normal.

const FPS = 30
const ENTER_AT = 2 * FPS
const ENTER_FRAMES = 12
const HOLD_SECONDS = 7 // matches AUTO_DISMISS_MS in components/InterruptStack.tsx
const LEAVE_AT = ENTER_AT + ENTER_FRAMES + HOLD_SECONDS * FPS
const LEAVE_FRAMES = 10

const RESTING_CARDS = [
  { tag: 'IMPORTANT', color: COLORS.warn, text: 'Claim Jaylen Warren in League 2. Waiver cutoff 3:00 PM.' },
  { tag: 'REVIEW', color: COLORS.signal, text: 'Trade pending: your Kupp for their Ekeler. Lean accept.' },
  { tag: 'WATCH', color: COLORS.textMuted, text: 'Joe Mixon is questionable. Pivot ready: Zach Moss.' },
]

export const InterruptStackReveal: React.FC = () => {
  const frame = useCurrentFrame()

  const enterProgress = interpolate(frame, [ENTER_AT, ENTER_AT + ENTER_FRAMES], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })
  const leaveProgress = interpolate(frame, [LEAVE_AT, LEAVE_AT + LEAVE_FRAMES], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })
  const cardVisibility = Math.min(enterProgress, leaveProgress)
  const cardY = interpolate(cardVisibility, [0, 1], [-24, 0])

  const camera = cameraStyle(frame, [
    { frame: 0, scale: 1, originX: 62, originY: 22 },
    { frame: ENTER_AT - 10, scale: 1, originX: 62, originY: 22 },
    { frame: ENTER_AT + ENTER_FRAMES + 15, scale: 1.14, originX: 62, originY: 22 },
    { frame: LEAVE_AT - 10, scale: 1.14, originX: 62, originY: 22 },
    { frame: LEAVE_AT + 40, scale: 1, originX: 62, originY: 22 },
  ])

  return (
    <AbsoluteFill style={{ overflow: 'hidden' }}>
      <div style={{ width: '100%', height: '100%', ...camera }}>
        <AppFrame state="game_day">
          <div style={{ position: 'relative', width: '100%', height: '100%', fontFamily, padding: '44px 48px' }}>
            <span style={{ color: COLORS.crit, fontSize: 20, letterSpacing: 3, fontWeight: 700 }}>MISSION CONTROL</span>
            <h1 style={{ color: COLORS.textPrimary, fontSize: 40, fontWeight: 700, marginTop: 14 }}>
              Every live game touching your rosters.
            </h1>

            <div style={{ marginTop: 32, display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 760 }}>
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
                  <div style={{ color: COLORS.textPrimary, fontSize: 17, marginTop: 6 }}>{c.text}</div>
                </div>
              ))}
            </div>

            {/* The interrupt card itself, overlaying the resting feed exactly
                like the real product's single always-on-top slot. */}
            <div
              style={{
                position: 'absolute',
                top: 210,
                left: 900,
                transform: `translateY(${cardY}px)`,
                opacity: cardVisibility,
                width: 560,
                padding: '26px 32px',
                borderRadius: 18,
                backgroundColor: 'rgba(15,34,53,0.96)',
                borderLeft: `5px solid ${COLORS.warn}`,
                boxShadow: `0 24px 60px rgba(0,0,0,.5), 0 0 40px ${COLORS.warn}33`,
              }}
            >
              <span style={{ color: COLORS.warn, fontSize: 16, letterSpacing: 3, fontWeight: 700 }}>TOUCHDOWN</span>
              <div style={{ color: COLORS.textPrimary, fontSize: 28, fontWeight: 700, marginTop: 8 }}>
                Bijan Robinson, 14-yard TD.
              </div>
              <div style={{ color: COLORS.textMuted, fontSize: 18, marginTop: 6 }}>
                +8.4 pts in League 2. Clears itself in a few seconds.
              </div>
            </div>

            <Callout
              x={1180}
              y={200}
              side="above"
              width={420}
              appearAt={ENTER_AT + ENTER_FRAMES + 20}
              holdFrames={HOLD_SECONDS * FPS - 60}
              text="One interrupt at a time. Everything else waits its turn, no matter how many leagues are live."
            />
          </div>
        </AppFrame>
      </div>
    </AbsoluteFill>
  )
}
