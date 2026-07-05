'use client'

// T-89: Player Intelligence Card (PRD 6.11). Mounted once in AppShell,
// opened from anywhere via the 'rostiro:open-player-card' event (same
// pattern as CommandPalette's own 'rostiro:open-command-palette') — keeps
// the trigger (⌘K player search) decoupled from this component's own
// fetch/render lifecycle.

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useFocusTrap } from '@/lib/useFocusTrap'

interface Availability {
  leagueId: string
  leagueName: string
  status: 'mine' | 'rostered_elsewhere' | 'free_agent'
  isStarter: boolean
}

interface Usage {
  season: number
  week: number
  offense_snaps: number
  offense_pct: number | null
  defense_snaps: number
  defense_pct: number | null
}

interface Context {
  reasoning: string
  kind: string
  headline: string | null
  link: string | null
}

interface Intelligence {
  player: {
    playerId: string
    name: string
    position: string | null
    nflTeam: string | null
    injuryStatus: string | null
    adpSleeper: number | null
    depthChartOrder: number | null
    depthChartPosition: string | null
  }
  availability: Availability[]
  usage: Usage | null
  context: Context | null
}

const STATUS_LABEL: Record<Availability['status'], string> = {
  mine: 'On your roster',
  rostered_elsewhere: 'Rostered by an opponent',
  free_agent: 'Free agent',
}

const STATUS_COLOR: Record<Availability['status'], string> = {
  mine: 'var(--signal)',
  rostered_elsewhere: 'var(--t3)',
  free_agent: 'var(--live)',
}

export default function PlayerIntelligenceCard() {
  const [playerId, setPlayerId] = useState<string | null>(null)
  const [renderedPlayerId, setRenderedPlayerId] = useState<string | null>(null)
  const [data, setData] = useState<Intelligence | null>(null)
  const [error, setError] = useState<string | null>(null)
  const cardRef = useRef<HTMLDivElement>(null)
  useFocusTrap(playerId !== null, cardRef)

  // React's own documented pattern for "reset state when a prop changes" —
  // resetting during render instead of inside an effect avoids the
  // cascading-render footgun the set-state-in-effect lint rule flags,
  // since this is plain render logic, not a synchronous effect side effect.
  if (playerId !== renderedPlayerId) {
    setRenderedPlayerId(playerId)
    setData(null)
    setError(null)
  }

  useEffect(() => {
    function onOpen(e: Event) {
      const detail = (e as CustomEvent<{ playerId: string }>).detail
      if (detail?.playerId) setPlayerId(detail.playerId)
    }
    window.addEventListener('rostiro:open-player-card', onOpen)
    return () => window.removeEventListener('rostiro:open-player-card', onOpen)
  }, [])

  useEffect(() => {
    if (!playerId) return
    let cancelled = false
    fetch(`/api/players/${playerId}/intelligence`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error('Failed to load'))))
      .then((json: Intelligence) => {
        if (!cancelled) setData(json)
      })
      .catch(() => {
        if (!cancelled) setError('Could not load this player right now.')
      })
    return () => {
      cancelled = true
    }
  }, [playerId])

  const loading = playerId !== null && data === null && error === null

  useEffect(() => {
    function onEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') setPlayerId(null)
    }
    if (playerId) window.addEventListener('keydown', onEscape)
    return () => window.removeEventListener('keydown', onEscape)
  }, [playerId])

  if (!playerId) return null

  return createPortal(
    <div
      className="fixed inset-0 z-40 flex items-start justify-center px-4 pt-[10vh]"
      style={{ backgroundColor: 'rgba(3, 7, 13, 0.45)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)' }}
      onClick={() => setPlayerId(null)}
    >
      <div
        ref={cardRef}
        className="glass-heavy panel-enter w-full max-w-[440px] rounded-[15px] p-6 relative"
        style={{ maxHeight: '72vh', overflowY: 'auto', boxShadow: '0 30px 90px rgba(0,0,0,.6), 0 0 50px rgba(75,163,245,.10)' }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Player intelligence"
        tabIndex={-1}
      >
        <button
          onClick={() => setPlayerId(null)}
          aria-label="Close"
          className="absolute top-3.5 right-3.5 px-2 py-1 text-[15px]"
          style={{ color: 'var(--t3)' }}
        >
          ✕
        </button>

        {loading && <p className="text-[12.5px] py-8 text-center" style={{ color: 'var(--t3)' }}>Loading…</p>}
        {error && <p className="text-[12.5px] py-8 text-center" style={{ color: 'var(--crit)' }}>{error}</p>}

        {data && (
          <>
            <span className="mono-data text-[9px] tracking-[0.16em]" style={{ color: 'var(--signal)' }}>
              PLAYER INTELLIGENCE
            </span>
            <h2 className="text-[19px] font-semibold mt-2" style={{ color: 'var(--t1)' }}>{data.player.name}</h2>
            <p className="mono-data text-[10.5px] mt-1" style={{ color: 'var(--t3)' }}>
              {data.player.position} · {data.player.nflTeam || 'FA'}
              {data.player.adpSleeper !== null ? ` · ADP ${Math.round(data.player.adpSleeper)}` : ''}
              {data.player.depthChartOrder !== null ? ` · Depth #${data.player.depthChartOrder}` : ''}
            </p>
            {data.player.injuryStatus && (
              <p className="mono-data text-[10.5px] mt-1" style={{ color: 'var(--crit)' }}>
                {data.player.injuryStatus.toUpperCase()}
              </p>
            )}

            {data.context && (
              <div className="mt-4 rounded-[10px] px-3.5 py-3" style={{ border: '1px solid var(--hairline)', backgroundColor: 'rgba(75,163,245,0.06)' }}>
                {data.context.headline && (
                  <p className="text-[12px] font-medium mb-1" style={{ color: 'var(--t1)' }}>{data.context.headline}</p>
                )}
                <p className="text-[12px] leading-relaxed" style={{ color: 'var(--t2)' }}>{data.context.reasoning}</p>
                {data.context.link && (
                  <a href={data.context.link} target="_blank" rel="noopener noreferrer" className="mono-data text-[10px] mt-1.5 inline-block" style={{ color: 'var(--signal)' }}>
                    Read on ESPN →
                  </a>
                )}
              </div>
            )}

            {data.usage && (
              <div className="mono-data mt-4 rounded-[10px] px-3.5 py-3 text-[11px] space-y-1.5" style={{ border: '1px solid var(--hairline)' }}>
                <p className="text-[9px] tracking-[0.14em]" style={{ color: 'var(--t3)' }}>USAGE — WEEK {data.usage.week}</p>
                <div className="flex justify-between">
                  <span style={{ color: 'var(--t3)' }}>OFFENSE SNAPS</span>
                  <span style={{ color: 'var(--t1)' }}>
                    {data.usage.offense_snaps}{data.usage.offense_pct !== null ? ` (${Math.round(data.usage.offense_pct)}%)` : ''}
                  </span>
                </div>
              </div>
            )}

            <div className="mt-4">
              <p className="mono-data text-[9px] tracking-[0.14em] mb-2" style={{ color: 'var(--t3)' }}>AVAILABILITY</p>
              <div className="space-y-1.5">
                {data.availability.length === 0 && (
                  <p className="text-[12px]" style={{ color: 'var(--t3)' }}>No connected leagues to check.</p>
                )}
                {data.availability.map((a) => (
                  <div key={a.leagueId} className="flex items-center justify-between text-[12px]">
                    <span style={{ color: 'var(--t2)' }}>{a.leagueName}</span>
                    <span className="mono-data text-[10px]" style={{ color: STATUS_COLOR[a.status] }}>
                      {STATUS_LABEL[a.status]}{a.isStarter ? ' · STARTING' : ''}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>,
    document.body
  )
}
