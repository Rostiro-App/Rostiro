import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion'
import { loadFont } from '@remotion/google-fonts/Inter'
import { COLORS } from '../tokens'
import { AppFrame } from '../components/AppFrame'
import { Callout } from '../components/Callout'
import { cameraStyle } from '../components/camera'

const { fontFamily } = loadFont()

// STAGED REENACTMENT, NOT REAL ACCOUNT FOOTAGE. Rostiro_Video_Shotlist.md's
// Clip 1 requires the founder's real Sleeper/Yahoo/ESPN accounts connected
// on camera — that can't be authentically fabricated, so this is a labeled
// placeholder walkthrough with mock usernames, watermarked throughout, to
// fill the ProductVideoDemo slot until the real founder footage exists.
// Delete this composition's usage the moment real footage is shot.
//
// Phase 1 mirrors the real onboarding screen's actual layout (centered
// card, step label, no sidebar/System Bar — onboarding runs outside the
// authenticated shell in the real product, per app/(auth)/onboarding).
// Phase 2 mirrors the real authenticated shell (AppFrame) once "connected."
// The camera pushes toward each platform card as it connects, then settles
// wide before cutting to the Pulse view.

const FPS = 30
const PLATFORMS = [
  { name: 'Sleeper', connectAt: 3 * FPS, account: 'placeholder_user', originX: 32 },
  { name: 'Yahoo', connectAt: 6 * FPS, account: 'OAuth (placeholder)', originX: 50 },
  { name: 'ESPN', connectAt: 9 * FPS, account: 'Cookie (placeholder)', originX: 68 },
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

  const camera = cameraStyle(frame, [
    { frame: 0, scale: 1, originX: 50, originY: 40 },
    { frame: PLATFORMS[0].connectAt - 20, scale: 1, originX: 50, originY: 40 },
    { frame: PLATFORMS[0].connectAt + 15, scale: 1.16, originX: PLATFORMS[0].originX, originY: 40 },
    { frame: PLATFORMS[1].connectAt - 15, scale: 1.16, originX: PLATFORMS[0].originX, originY: 40 },
    { frame: PLATFORMS[1].connectAt + 15, scale: 1.16, originX: PLATFORMS[1].originX, originY: 40 },
    { frame: PLATFORMS[2].connectAt - 15, scale: 1.16, originX: PLATFORMS[1].originX, originY: 40 },
    { frame: PLATFORMS[2].connectAt + 15, scale: 1.16, originX: PLATFORMS[2].originX, originY: 40 },
    { frame: PLATFORMS[2].connectAt + 45, scale: 1, originX: 50, originY: 40 },
    { frame: PULSE_AT - 10, scale: 1, originX: 50, originY: 40 },
    { frame: PULSE_AT + 40, scale: 1.05, originX: 30, originY: 15 },
    { frame: PULSE_AT + 25 * FPS, scale: 1.05, originX: 30, originY: 15 },
  ])

  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.void, fontFamily, overflow: 'hidden' }}>
      {/* Persistent honesty label, never removed. Bottom-center rather than
          top-right: once Phase 2's AppFrame renders, the System Bar's own
          state/plan/mode chips occupy the top-right corner, and stacking
          this badge on top of them was an actual visual collision, not
          just close spacing. */}
      <div
        style={{
          position: 'absolute',
          bottom: 32,
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 30,
          padding: '10px 24px',
          borderRadius: 999,
          backgroundColor: 'rgba(232,80,74,0.14)',
          border: `1.5px solid ${COLORS.crit}`,
          color: COLORS.crit,
          fontSize: 16,
          fontWeight: 700,
          letterSpacing: 1.5,
          whiteSpace: 'nowrap',
        }}
      >
        ILLUSTRATIVE REENACTMENT — NOT REAL ACCOUNT FOOTAGE
      </div>

      <div style={{ width: '100%', height: '100%', ...camera }}>
        {!showPulse || connectOpacity > 0 ? (
          <div style={{ opacity: connectOpacity, width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ maxWidth: 1100, width: '100%' }}>
              <p style={{ textAlign: 'center', color: COLORS.signal, fontSize: 15, fontWeight: 700, letterSpacing: 3, marginBottom: 12 }}>
                ROSTIRO · STEP 2 OF 6
              </p>
              <h1 style={{ color: COLORS.textPrimary, fontSize: 44, fontWeight: 700, textAlign: 'center' }}>
                Connect your leagues
              </h1>
              <p style={{ color: COLORS.textMuted, fontSize: 18, textAlign: 'center', marginTop: 10 }}>
                Connect at least one. Rostiro can&apos;t help until you do.
              </p>
              <div style={{ display: 'flex', gap: 28, marginTop: 56, justifyContent: 'center' }}>
                {PLATFORMS.map((p) => {
                  const connected = frame >= p.connectAt
                  return (
                    <div
                      key={p.name}
                      style={{
                        width: 320,
                        padding: '30px',
                        borderRadius: 18,
                        backgroundColor: COLORS.navyCard,
                        border: `1.5px solid ${connected ? COLORS.live : COLORS.hairline}`,
                      }}
                    >
                      <div style={{ color: COLORS.textPrimary, fontSize: 24, fontWeight: 700 }}>{p.name}</div>
                      <div style={{ color: COLORS.textMuted, fontSize: 16, marginTop: 8 }}>{p.account}</div>
                      <div
                        style={{
                          marginTop: 20,
                          fontSize: 16,
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
          </div>
        ) : null}

        {showPulse && (
          <AbsoluteFill style={{ opacity: pulseOpacity }}>
            <AppFrame state="standard" modeLabel="BALANCED">
              <div style={{ position: 'relative', width: '100%', height: '100%', fontFamily, padding: '44px 48px' }}>
                <span style={{ color: COLORS.signal, fontSize: 20, letterSpacing: 3, fontWeight: 700 }}>PULSE</span>
                <h1 style={{ color: COLORS.textPrimary, fontSize: 40, fontWeight: 700, marginTop: 12 }}>
                  Three leagues, one morning list.
                </h1>
                <div style={{ marginTop: 32, display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 820 }}>
                  {PULSE_ITEMS.map((item) => (
                    <div
                      key={item.league}
                      style={{
                        padding: '20px 26px',
                        borderRadius: 14,
                        backgroundColor: COLORS.navyCard,
                        borderLeft: `4px solid ${COLORS.signal}`,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 18,
                      }}
                    >
                      <span style={{ fontSize: 13, fontWeight: 700, color: COLORS.signal, letterSpacing: 1, minWidth: 80 }}>
                        {item.league.toUpperCase()}
                      </span>
                      <span style={{ color: COLORS.textPrimary, fontSize: 19 }}>{item.text}</span>
                    </div>
                  ))}
                </div>

                <Callout
                  x={400}
                  y={30}
                  side="above"
                  width={440}
                  appearAt={PULSE_AT + 60}
                  holdFrames={9 * FPS}
                  text="Three real platforms, one unified list — every card names which league it came from."
                />
              </div>
            </AppFrame>
          </AbsoluteFill>
        )}
      </div>
    </AbsoluteFill>
  )
}
