import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion'
import { loadFont } from '@remotion/google-fonts/Inter'
import { COLORS, STATE_COLOR } from '../tokens'

const { fontFamily } = loadFont()

// Recreates the real Interrupt Stack (components/InterruptStack.tsx): one
// persistent slot, not a notification pile. A touchdown_swing event takes
// the slot, names exactly what happened, holds for the real 7-second
// AUTO_DISMISS_MS window, then clears itself on its own, unforced.

const FPS = 30
const ENTER_AT = 2 * FPS
const ENTER_FRAMES = 12
const HOLD_SECONDS = 7 // matches AUTO_DISMISS_MS in components/InterruptStack.tsx
const LEAVE_AT = ENTER_AT + ENTER_FRAMES + HOLD_SECONDS * FPS
const LEAVE_FRAMES = 10
const CAPTION_AT = LEAVE_AT + LEAVE_FRAMES + 10

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
  const captionOpacity = interpolate(frame, [CAPTION_AT, CAPTION_AT + 20], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })

  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.void, fontFamily }}>
      {/* Ambient Game Day System Bar, calm background the interrupt sits above */}
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
            SYNCED 2S AGO
          </span>
        </div>
        <span
          style={{
            fontSize: 20,
            fontWeight: 700,
            letterSpacing: 3,
            padding: '8px 20px',
            borderRadius: 999,
            color: STATE_COLOR.game_day,
            border: `1.5px solid ${STATE_COLOR.game_day}`,
          }}
        >
          GAME DAY
        </span>
      </div>

      {/* The interrupt card itself */}
      <div
        style={{
          position: 'absolute',
          top: 160,
          left: '50%',
          transform: `translateX(-50%) translateY(${cardY}px)`,
          opacity: cardVisibility,
          width: 720,
          padding: '32px 40px',
          borderRadius: 20,
          backgroundColor: 'rgba(15,34,53,0.92)',
          borderLeft: `5px solid ${COLORS.warn}`,
          boxShadow: `0 24px 60px rgba(0,0,0,.5), 0 0 40px ${COLORS.warn}33`,
        }}
      >
        <span style={{ color: COLORS.warn, fontSize: 20, letterSpacing: 3, fontWeight: 700 }}>TOUCHDOWN</span>
        <div style={{ color: COLORS.textPrimary, fontSize: 34, fontWeight: 700, marginTop: 10 }}>
          Bijan Robinson, 14-yard TD.
        </div>
        <div style={{ color: COLORS.textMuted, fontSize: 22, marginTop: 8 }}>
          +8.4 pts in League 2. Clears itself in a few seconds.
        </div>
      </div>

      {/* Explanatory caption, fades in after the card auto-dismisses */}
      <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', top: 200 }}>
        <div style={{ opacity: captionOpacity, textAlign: 'center', maxWidth: 900 }}>
          <div style={{ color: COLORS.textPrimary, fontSize: 40, fontWeight: 700 }}>
            One interrupt at a time.
          </div>
          <div style={{ color: COLORS.textMuted, fontSize: 24, marginTop: 16 }}>
            Everything else waits its turn, no matter how many leagues are live.
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  )
}
