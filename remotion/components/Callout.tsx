import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion'
import { COLORS, FONT_FAMILY } from '../tokens'

// A floating annotation bubble with a small pointer, used to narrate what a
// scene is demonstrating without voiceover (silent B-roll per the shotlist).
// Anchors near a specific point in the frame and points toward it, springs
// in, holds, then fades out — the same three-beat pattern as a real UI
// tooltip, not a hard cut.

interface CalloutProps {
  x: number
  y: number
  text: string
  /** Which side of the anchor point the bubble sits on. */
  side?: 'above' | 'below'
  appearAt: number
  holdFrames: number
  width?: number
}

export function Callout({ x, y, text, side = 'above', appearAt, holdFrames, width = 340 }: CalloutProps) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const leaveAt = appearAt + holdFrames

  const entrance = spring({ frame: frame - appearAt, fps, config: { damping: 14, stiffness: 140 } })
  const exit = interpolate(frame, [leaveAt, leaveAt + 12], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })
  const visibility = frame < appearAt ? 0 : Math.min(entrance, exit)
  if (visibility <= 0.01) return null

  const offsetY = side === 'above' ? -18 : 18
  const translateY = side === 'above' ? (1 - entrance) * 14 : (1 - entrance) * -14

  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y + offsetY,
        transform: `translate(-50%, ${side === 'above' ? '-100%' : '0%'}) translateY(${translateY}px)`,
        opacity: visibility,
        width,
        pointerEvents: 'none',
        zIndex: 20,
      }}
    >
      <div
        style={{
          backgroundColor: 'rgba(15,34,53,0.96)',
          border: `1px solid ${COLORS.hairlineBright}`,
          borderRadius: 12,
          padding: '14px 18px',
          fontFamily: FONT_FAMILY,
          fontSize: 17,
          fontWeight: 500,
          color: COLORS.textPrimary,
          lineHeight: 1.4,
          boxShadow: '0 12px 30px rgba(0,0,0,.45)',
        }}
      >
        {text}
      </div>
      {/* Pointer triangle toward the anchor */}
      <div
        style={{
          position: 'absolute',
          left: '50%',
          transform: 'translateX(-50%)',
          ...(side === 'above'
            ? { bottom: -7, borderTop: '8px solid rgba(15,34,53,0.96)' }
            : { top: -7, borderBottom: '8px solid rgba(15,34,53,0.96)' }),
          width: 0,
          height: 0,
          borderLeft: '7px solid transparent',
          borderRight: '7px solid transparent',
        }}
      />
    </div>
  )
}
