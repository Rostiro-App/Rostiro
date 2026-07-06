import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion'
import { loadFont } from '@remotion/google-fonts/Inter'
import { COLORS } from '../tokens'
import { AppFrame } from '../components/AppFrame'
import { PulseHeader } from '../components/PulseHeader'
import { PulseCardMock } from '../components/PulseCardMock'
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
  {
    headline: 'Bench Diggs, 2 leagues',
    league: 'Dynasty Kings',
    platform: 'Sleeper',
    tag: 'WEATHER',
    tagColor: COLORS.warn,
    priorityColor: COLORS.crit,
    reasoning: '31mph winds in Buffalo at kickoff.',
  },
  {
    headline: 'Claim Jaylen Warren',
    league: 'Gridiron Co.',
    platform: 'Yahoo',
    tag: 'WAIVER',
    tagColor: COLORS.live,
    priorityColor: COLORS.warn,
    reasoning: 'Cutoff 3:00 PM today.',
  },
  {
    headline: 'Trade pending: Kupp for Ekeler',
    league: 'The League',
    platform: 'ESPN',
    tag: 'REVIEW',
    tagColor: COLORS.signal,
    priorityColor: COLORS.signal,
    reasoning: 'Lean accept, it fixes your RB2 gap.',
  },
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
              <div style={{ position: 'relative', width: '100%', height: '100%', fontFamily, padding: '40px 48px' }}>
                <PulseHeader
                  state="standard"
                  greeting="Good morning, Lawrence."
                  decisions={3}
                  leagues={3}
                  estMinutes={4}
                  doneToday={0}
                  totalToday={3}
                />
                <div style={{ marginTop: 24, display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 820 }}>
                  {PULSE_ITEMS.map((item) => (
                    <PulseCardMock key={item.headline} {...item} />
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
