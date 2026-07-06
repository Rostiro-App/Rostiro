import { COLORS, STATE_COLOR, FONT_FAMILY } from '../tokens'
import type { RostiroStateKey } from '../tokens'

// A static visual recreation of the real authenticated shell
// (components/nav/Sidebar.tsx + SystemBar.tsx), scaled up for a 1920x1080
// canvas. Not the live components themselves — those fetch real data via
// hooks/Supabase and can't run inside Remotion's isolated render — but the
// same icon set, dock layout, and System Bar fields, so a viewer who later
// opens the real product recognizes exactly this chrome.

const DOCK_ICONS: { label: string; active?: boolean }[] = [
  { label: 'Pulse', active: true },
  { label: 'Leagues' },
  { label: 'Draft' },
  { label: 'Lineups' },
  { label: 'Trades' },
]

export function AppFrame({
  state,
  children,
  planLabel = 'PRO',
  modeLabel = 'BALANCED',
}: {
  state: RostiroStateKey
  children: React.ReactNode
  planLabel?: string
  modeLabel?: string
}) {
  const accent = STATE_COLOR[state]
  const stateDisplay = state.replace('_', ' ').toUpperCase()

  return (
    <div style={{ display: 'flex', width: '100%', height: '100%', backgroundColor: COLORS.void, fontFamily: FONT_FAMILY }}>
      {/* Icon dock */}
      <div
        style={{
          width: 84,
          flexShrink: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          paddingTop: 28,
          gap: 10,
          borderRight: `1px solid ${COLORS.hairline}`,
          backgroundColor: 'rgba(8,15,26,0.5)',
        }}
      >
        {DOCK_ICONS.map((item) => (
          <div
            key={item.label}
            style={{
              width: 52,
              height: 52,
              borderRadius: 14,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: item.active ? accent : COLORS.textMuted,
              backgroundColor: item.active ? `${accent}1E` : 'transparent',
              boxShadow: item.active ? `0 0 18px ${accent}33, inset 0 0 0 1px ${accent}4D` : 'none',
            }}
          >
            <DockIcon />
          </div>
        ))}
      </div>

      {/* Right column: System Bar + main content */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <div
          style={{
            height: 64,
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            gap: 28,
            padding: '0 32px',
            borderBottom: `1px solid ${COLORS.hairline}`,
            backgroundColor: 'rgba(13,27,42,0.6)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 8, height: 8, borderRadius: 999, backgroundColor: accent }} />
            <span style={{ color: COLORS.textPrimary, fontWeight: 700, fontSize: 18, letterSpacing: 3 }}>ROSTIRO</span>
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: 2,
                color: COLORS.signal,
                border: `1px solid ${COLORS.signal}73`,
                borderRadius: 4,
                padding: '1px 5px',
              }}
            >
              OS
            </span>
          </div>

          <div style={{ width: 1, height: 20, backgroundColor: COLORS.hairline }} />

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: COLORS.textMuted, fontSize: 14 }}>
            <div style={{ width: 6, height: 6, borderRadius: 999, backgroundColor: COLORS.live }} />
            <span>SYNCED 8S AGO</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 11, letterSpacing: 1.5, color: COLORS.textMuted }}>LEAGUES</span>
            {[COLORS.live, COLORS.live, COLORS.warn].map((c, i) => (
              <div key={i} style={{ width: 9, height: 9, borderRadius: 999, backgroundColor: c, boxShadow: `0 0 6px ${c}` }} />
            ))}
          </div>

          <div style={{ flex: 1 }} />

          <span
            style={{
              fontSize: 13,
              fontWeight: 700,
              letterSpacing: 2,
              color: accent,
              border: `1.5px solid ${accent}`,
              borderRadius: 999,
              padding: '5px 16px',
            }}
          >
            {stateDisplay}
          </span>

          <span
            style={{
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: 1,
              color: '#F5C842',
              border: '1px solid rgba(245,200,66,0.5)',
              borderRadius: 4,
              padding: '3px 9px',
            }}
          >
            {planLabel}
          </span>

          <span
            style={{
              fontSize: 13,
              color: COLORS.textPrimary,
              border: `1px solid ${COLORS.hairline}`,
              borderRadius: 8,
              padding: '6px 14px',
            }}
          >
            {modeLabel}
          </span>
        </div>

        <div style={{ flex: 1, position: 'relative', minHeight: 0 }}>{children}</div>
      </div>
    </div>
  )
}

function DockIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="4" width="16" height="16" rx="3" />
    </svg>
  )
}
