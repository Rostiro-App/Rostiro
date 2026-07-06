import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion'
import { loadFont } from '@remotion/google-fonts/Inter'
import { COLORS } from '../tokens'
import { AppFrame } from '../components/AppFrame'
import { PulseHeader } from '../components/PulseHeader'
import { PulseCardMock } from '../components/PulseCardMock'
import { Callout } from '../components/Callout'
import { cameraStyle } from '../components/camera'

const { fontFamily } = loadFont()

// Recreates the real Interrupt Stack (components/InterruptStack.tsx) inside
// the real app shell during Game Day: one persistent slot, not a
// notification pile. A touchdown_swing event takes the slot, names exactly
// what happened, holds for the real 7-second AUTO_DISMISS_MS window, then
// clears itself on its own, unforced. Rebuilt 2026-07-06 with the real
// dock icons, System Bar, and PulseHeader/PulseCardMock anatomy after
// founder review found the first pass approximated all three.

const FPS = 30
const ENTER_AT = 2 * FPS
const ENTER_FRAMES = 12
const HOLD_SECONDS = 7 // matches AUTO_DISMISS_MS in components/InterruptStack.tsx
const LEAVE_AT = ENTER_AT + ENTER_FRAMES + HOLD_SECONDS * FPS
const LEAVE_FRAMES = 10

const RESTING_CARDS = [
  {
    headline: 'Claim Jaylen Warren in League 2',
    league: 'Gridiron Co.',
    platform: 'Yahoo',
    tag: 'IMPORTANT',
    tagColor: COLORS.warn,
    priorityColor: COLORS.warn,
    reasoning: 'Waiver cutoff 3:00 PM today. $100 of $100 FAAB left.',
  },
  {
    headline: 'Trade pending: your Kupp for their Ekeler',
    league: 'Dynasty Kings',
    platform: 'Sleeper',
    tag: 'REVIEW',
    tagColor: COLORS.signal,
    priorityColor: COLORS.signal,
    reasoning: 'Lean accept, it fixes your RB2 gap.',
  },
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
          <div style={{ position: 'relative', width: '100%', height: '100%', fontFamily, padding: '40px 48px' }}>
            <PulseHeader
              state="game_day"
              greeting="Good afternoon, Lawrence."
              decisions={4}
              leagues={3}
              estMinutes={5}
              doneToday={1}
              totalToday={4}
            />

            <div style={{ marginTop: 24, display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 760 }}>
              {RESTING_CARDS.map((c) => (
                <PulseCardMock key={c.headline} {...c} />
              ))}
            </div>

            {/* The interrupt card itself — real InterruptStack.tsx anatomy:
                glass-heavy, 2.5px colored left border, mono type label, no
                Done/Snooze (it's transient, not a queue item), overlaying
                the resting feed exactly like the real product's single
                always-on-top slot. */}
            <div
              style={{
                position: 'absolute',
                top: 200,
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
              y={170}
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
