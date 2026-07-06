import { COLORS, STATE_COLOR } from '../tokens'
import type { RostiroStateKey } from '../tokens'

// Matches app/(dashboard)/pulse/page.tsx's real header exactly: an optional
// state-relabel badge (MISSION CONTROL for Game Day, MISSION BRIEFING for
// Waiver Day), the greeting + bold decision count + est. minutes line, and
// the TODAY progress bar — a real, distinctive element the first Remotion
// pass missed entirely.

const STATE_BADGE_LABEL: Partial<Record<RostiroStateKey, string>> = {
  game_day: 'MISSION CONTROL',
  waiver_day: 'MISSION BRIEFING',
}

export function PulseHeader({
  state,
  greeting,
  decisions,
  leagues,
  estMinutes,
  doneToday,
  totalToday,
}: {
  state: RostiroStateKey
  greeting: string
  decisions: number
  leagues: number
  estMinutes: number
  doneToday: number
  totalToday: number
}) {
  const accent = STATE_COLOR[state]
  const badgeLabel = STATE_BADGE_LABEL[state]

  return (
    <div>
      {badgeLabel && (
        <span
          style={{
            display: 'inline-block',
            fontSize: 14,
            letterSpacing: 2,
            padding: '4px 12px',
            borderRadius: 999,
            marginBottom: 10,
            color: accent,
            border: `1px solid ${accent}`,
            backgroundColor: `${accent}1E`,
          }}
        >
          {badgeLabel}
        </span>
      )}
      <h1 style={{ color: COLORS.textPrimary, fontSize: 32, fontWeight: 600, margin: 0 }}>{greeting}</h1>
      <p style={{ color: COLORS.textMuted, fontSize: 19, marginTop: 4 }}>
        <b style={{ color: COLORS.textPrimary, fontWeight: 600 }}>
          {decisions} {decisions === 1 ? 'decision' : 'decisions'}
        </b>
        {` across ${leagues} ${leagues === 1 ? 'league' : 'leagues'}`}
        {estMinutes > 0 && (
          <>
            {' · Est. '}
            <b style={{ color: COLORS.textPrimary, fontWeight: 600 }}>{estMinutes} min</b>
          </>
        )}
      </p>

      {totalToday > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 20, fontSize: 14, letterSpacing: 1.5, color: COLORS.textMuted }}>
          <span>TODAY</span>
          <div style={{ flex: 1, height: 4, borderRadius: 999, overflow: 'hidden', backgroundColor: 'rgba(90,150,210,.12)' }}>
            <div
              style={{
                height: '100%',
                borderRadius: 999,
                width: `${Math.round((doneToday / totalToday) * 100)}%`,
                background: doneToday === totalToday ? COLORS.live : `linear-gradient(90deg, ${COLORS.signal}, #6FC7FF)`,
                boxShadow: '0 0 10px rgba(75,163,245,.6)',
              }}
            />
          </div>
          <span>{doneToday} / {totalToday}</span>
        </div>
      )}
    </div>
  )
}
