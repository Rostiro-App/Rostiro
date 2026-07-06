import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion'
import { loadFont } from '@remotion/google-fonts/Inter'
import { COLORS } from '../tokens'

const { fontFamily } = loadFont()

// STAGED REENACTMENT, NOT REAL ACCOUNT FOOTAGE. Rostiro_Video_Shotlist.md's
// Clip 1 requires the founder's real Sleeper/Yahoo/ESPN accounts connected
// on camera — that can't be authentically fabricated, so this is a labeled
// placeholder walkthrough with mock usernames, watermarked throughout, to
// fill the ProductVideoDemo slot until the real founder footage exists.
// Delete this composition's usage the moment real footage is shot.

const FPS = 30
const PLATFORMS = [
  { name: 'Sleeper', connectAt: 3 * FPS, account: 'placeholder_user' },
  { name: 'Yahoo', connectAt: 6 * FPS, account: 'OAuth (placeholder)' },
  { name: 'ESPN', connectAt: 9 * FPS, account: 'Cookie (placeholder)' },
]
const PULSE_AT = 12 * FPS

const PULSE_ITEMS = [
  { league: 'Sleeper', text: 'Bench Diggs, 2 leagues. 31mph winds at kickoff.' },
  { league: 'Yahoo', text: 'Claim Jaylen Warren. Cutoff 3:00 PM.' },
  { league: 'ESPN', text: 'Trade pending: Kupp for Ekeler. Lean accept.' },
]

export const MultiLeagueConnectReenactment: React.FC = () => {
  const frame = useCurrentFrame()
  const showPulse = frame >= PULSE_AT
  const pulseOpacity = interpolate(frame, [PULSE_AT, PULSE_AT + 20], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })
  const connectOpacity = interpolate(frame, [PULSE_AT, PULSE_AT + 20], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })

  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.void, fontFamily }}>
      {/* Persistent honesty label, never removed */}
      <div
        style={{
          position: 'absolute',
          top: 24,
          right: 24,
          zIndex: 10,
          padding: '10px 20px',
          borderRadius: 999,
          backgroundColor: 'rgba(232,80,74,0.14)',
          border: `1.5px solid ${COLORS.crit}`,
          color: COLORS.crit,
          fontSize: 16,
          fontWeight: 700,
          letterSpacing: 1.5,
        }}
      >
        ILLUSTRATIVE REENACTMENT — NOT REAL ACCOUNT FOOTAGE
      </div>

      {!showPulse || connectOpacity > 0 ? (
        <div style={{ opacity: connectOpacity, padding: '140px 56px 0' }}>
          <h1 style={{ color: COLORS.textPrimary, fontSize: 48, fontWeight: 700, textAlign: 'center' }}>
            Connect your leagues
          </h1>
          <div style={{ display: 'flex', gap: 28, marginTop: 64, justifyContent: 'center' }}>
            {PLATFORMS.map((p) => {
              const connected = frame >= p.connectAt
              return (
                <div
                  key={p.name}
                  style={{
                    width: 340,
                    padding: '32px',
                    borderRadius: 18,
                    backgroundColor: COLORS.navyCard,
                    border: `1.5px solid ${connected ? COLORS.live : COLORS.hairline}`,
                    transition: 'none',
                  }}
                >
                  <div style={{ color: COLORS.textPrimary, fontSize: 28, fontWeight: 700 }}>{p.name}</div>
                  <div style={{ color: COLORS.textMuted, fontSize: 18, marginTop: 8 }}>{p.account}</div>
                  <div
                    style={{
                      marginTop: 24,
                      fontSize: 18,
                      fontWeight: 700,
                      color: connected ? COLORS.live : COLORS.textDim,
                      letterSpacing: 1,
                    }}
                  >
                    {connected ? '✓ CONNECTED' : 'NOT CONNECTED'}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ) : null}

      {showPulse && (
        <AbsoluteFill style={{ opacity: pulseOpacity, padding: '120px 56px 0' }}>
          <span style={{ color: COLORS.signal, fontSize: 22, letterSpacing: 3, fontWeight: 600 }}>PULSE</span>
          <h1 style={{ color: COLORS.textPrimary, fontSize: 44, fontWeight: 700, marginTop: 12 }}>
            Three leagues, one morning list.
          </h1>
          <div style={{ marginTop: 40, display: 'flex', flexDirection: 'column', gap: 16 }}>
            {PULSE_ITEMS.map((item) => (
              <div
                key={item.league}
                style={{
                  padding: '24px 32px',
                  borderRadius: 14,
                  backgroundColor: COLORS.navyCard,
                  borderLeft: `4px solid ${COLORS.signal}`,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 20,
                }}
              >
                <span
                  style={{
                    fontSize: 15,
                    fontWeight: 700,
                    color: COLORS.signal,
                    letterSpacing: 1,
                    minWidth: 90,
                  }}
                >
                  {item.league.toUpperCase()}
                </span>
                <span style={{ color: COLORS.textPrimary, fontSize: 22 }}>{item.text}</span>
              </div>
            ))}
          </div>
        </AbsoluteFill>
      )}
    </AbsoluteFill>
  )
}
