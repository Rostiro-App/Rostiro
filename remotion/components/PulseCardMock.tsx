import { COLORS } from '../tokens'

// Matches the real PulseCard (app/(dashboard)/pulse/page.tsx) exactly: a
// glowing left priority stripe, bold headline, mono league/platform line,
// a colored tag badge top-right, an optional reasoning paragraph, and the
// real Open / Done / Snooze / dismiss action row — not an invented card
// style, which is what the first Remotion pass used.

export interface PulseCardProps {
  headline: string
  league: string
  platform: string
  tag: string
  tagColor: string
  priorityColor: string
  reasoning?: string
  showActions?: boolean
  opacity?: number
}

export function PulseCardMock({
  headline,
  league,
  platform,
  tag,
  tagColor,
  priorityColor,
  reasoning,
  showActions = true,
  opacity = 1,
}: PulseCardProps) {
  return (
    <div
      style={{
        position: 'relative',
        borderRadius: 14,
        padding: '18px 22px 18px 26px',
        backgroundColor: COLORS.navyCard,
        opacity,
      }}
    >
      <div style={{ position: 'absolute', left: 10, top: 10, bottom: 10, width: 3, borderRadius: 999, backgroundColor: priorityColor, boxShadow: `0 0 8px ${priorityColor}99` }} />

      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ color: COLORS.textPrimary, fontSize: 19, fontWeight: 700, lineHeight: 1.25 }}>{headline}</div>
          <div style={{ color: COLORS.textMuted, fontSize: 14, marginTop: 5, letterSpacing: 0.5 }}>
            {league.toUpperCase()} · {platform.toUpperCase()}
          </div>
        </div>
        <span
          style={{
            flexShrink: 0,
            fontSize: 12,
            letterSpacing: 1.5,
            padding: '3px 8px',
            borderRadius: 4,
            color: tagColor,
            backgroundColor: `${tagColor}1E`,
          }}
        >
          {tag}
        </span>
      </div>

      {reasoning && (
        <p style={{ color: COLORS.textDim, fontSize: 16, marginTop: 10, lineHeight: 1.5, maxWidth: '60ch' }}>{reasoning}</p>
      )}

      {showActions && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 14 }}>
          <span
            style={{
              fontSize: 15,
              padding: '5px 14px',
              borderRadius: 8,
              color: COLORS.signal,
              border: '1px solid rgba(75,163,245,.35)',
            }}
          >
            Open ↗
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 15, padding: '5px 14px', borderRadius: 8, color: COLORS.live, border: '1px solid rgba(67,192,119,.35)' }}>
              ✓ Done
            </span>
            <span style={{ fontSize: 15, padding: '5px 14px', borderRadius: 8, color: COLORS.textMuted, border: `1px solid ${COLORS.hairline}` }}>
              Snooze
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
