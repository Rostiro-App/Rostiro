'use client'

// T-118: "Hurts, Barkley (2 leagues)" — the Live Now / System Bar player
// attribution line (UX Behavior Spec Gap #1), now with each name opening
// the Player Intelligence Card instead of sitting as dead text. Shared
// between components/nav/SystemBar.tsx and app/(dashboard)/pulse/page.tsx,
// which independently reimplemented the exact same string before this.

import { openPlayerCard } from '@/lib/openPlayerCard'
import type { RelevantPlayer } from '@/types'

export default function PlayerSummaryLine({
  players,
  className,
  style,
}: {
  players: RelevantPlayer[]
  className?: string
  style?: React.CSSProperties
}) {
  if (!players || players.length === 0) return null
  const leagueCount = new Set(players.flatMap((p) => p.leagueNames)).size

  return (
    <span className={className} style={style}>
      {players.map((p, i) => (
        <span key={`${p.playerId}-${i}`}>
          {i > 0 && ', '}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              openPlayerCard(p.playerId)
            }}
            className="underline decoration-dotted underline-offset-2 hover:text-[var(--t1)]"
          >
            {p.name}
          </button>
        </span>
      ))}
      {leagueCount > 0 ? ` (${leagueCount} ${leagueCount === 1 ? 'league' : 'leagues'})` : ''}
    </span>
  )
}
