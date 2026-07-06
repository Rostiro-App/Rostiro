import { COLORS, STATE_COLOR, FONT_FAMILY } from '../tokens'
import type { RostiroStateKey } from '../tokens'

// A recreation of the real authenticated shell (components/nav/Sidebar.tsx
// + SystemBar.tsx), scaled up for a 1920x1080 canvas. Rebuilt a second time
// (2026-07-06) after founder review against a real /pulse screenshot found
// the first pass used placeholder square icons and an approximated System
// Bar — this version uses the exact SVG icon paths and System Bar field
// layout from the real components, not a generic recreation.

const DOCK_ITEMS: { label: string; active?: boolean; icon: React.ReactNode }[] = [
  {
    label: 'Pulse',
    active: true,
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
      </svg>
    ),
  },
  {
    label: 'Leagues',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7" rx="1.5" />
        <rect x="14" y="3" width="7" height="7" rx="1.5" />
        <rect x="3" y="14" width="7" height="7" rx="1.5" />
        <rect x="14" y="14" width="7" height="7" rx="1.5" />
      </svg>
    ),
  },
  {
    label: 'Draft Kit',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="9" y1="13" x2="15" y2="13" />
        <line x1="9" y1="17" x2="13" y2="17" />
      </svg>
    ),
  },
  {
    label: 'Lineups',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 00-3-3.87" />
        <path d="M16 3.13a4 4 0 010 7.75" />
      </svg>
    ),
  },
  {
    label: 'Trades',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="17 1 21 5 17 9" />
        <path d="M3 11V9a4 4 0 014-4h14" />
        <polyline points="7 23 3 19 7 15" />
        <path d="M21 13v2a4 4 0 01-4 4H3" />
      </svg>
    ),
  },
]

const SETTINGS_ICON = (
  <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
  </svg>
)

const HEALTH_DOT_COLOR = { healthy: COLORS.live, monitor: COLORS.warn, action: COLORS.crit } as const

export function AppFrame({
  state,
  children,
  planLabel = 'PRO',
  modeLabel = 'BALANCED',
  healthDots = ['healthy', 'healthy', 'monitor'],
  showTicker = true,
}: {
  state: RostiroStateKey
  children: React.ReactNode
  planLabel?: string
  modeLabel?: string
  healthDots?: Array<keyof typeof HEALTH_DOT_COLOR>
  showTicker?: boolean
}) {
  const accent = STATE_COLOR[state]
  const stateDisplay = state.replace('_', ' ').toUpperCase()

  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%', backgroundColor: COLORS.void, fontFamily: FONT_FAMILY }}>
      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        {/* Icon dock — real icon set/order from components/nav/Sidebar.tsx */}
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
          {DOCK_ITEMS.map((item) => (
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
              {item.icon}
            </div>
          ))}
          <div style={{ flex: 1 }} />
          <div style={{ width: 52, height: 52, borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', color: COLORS.textMuted }}>
            {SETTINGS_ICON}
          </div>
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
              {healthDots.map((status, i) => (
                <div key={i} style={{ width: 9, height: 9, borderRadius: 999, backgroundColor: HEALTH_DOT_COLOR[status], boxShadow: `0 0 6px ${HEALTH_DOT_COLOR[status]}` }} />
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

            <span
              style={{
                fontSize: 13,
                color: COLORS.textMuted,
                border: `1px solid ${COLORS.hairline}`,
                borderRadius: 8,
                padding: '6px 12px',
              }}
            >
              Command ⌘K
            </span>
          </div>

          <div style={{ flex: 1, position: 'relative', minHeight: 0 }}>{children}</div>
        </div>
      </div>

      {/* Bloomberg-style ticker strip — real format from components/nav/TickerBar.tsx */}
      {showTicker && (
        <div
          style={{
            height: 40,
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            gap: 28,
            padding: '0 24px',
            borderTop: `1px solid ${COLORS.hairline}`,
            backgroundColor: 'rgba(8,15,26,0.7)',
            fontSize: 13,
            color: COLORS.textMuted,
            letterSpacing: 0.5,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
          }}
        >
          <span style={{ color: COLORS.live }}>● LIVE</span>
          <span>ADP HISTORY · DAY 2 OF 7 — MOVERS UNLOCK WITH A WEEK OF DATA</span>
          <span>J.ALLEN QB · ADP 1</span>
          <span>B.ROBINSON RB · ADP 1</span>
          <span>J.CHASE WR · ADP 3</span>
          <span>J.GIBBS RB · ADP 3</span>
        </div>
      )}
    </div>
  )
}
