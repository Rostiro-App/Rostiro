'use client'

// OS redesign: Bloomberg-style strip anchored to the bottom of every
// authenticated screen. Crawls ADP movers once a week of snapshot history
// exists; until then it crawls the top of today's board and says exactly
// how much history has accumulated — never a fake delta. Desktop only
// (mobile gives the row to the bottom nav).
//
// Seasonal note: ADP movement is a preseason signal — it goes quiet once
// drafts finish. In-season the strip's data source swaps to waiver trends
// (Sleeper's trending-adds endpoint) and lineup-lock countdowns; the
// endpoint keeps the same response shape so this component won't change.

import { useEffect, useState } from 'react'
import type { LiveGameScore, RostiroState } from '@/types'

interface Mover {
  name: string
  position: string | null
  adp: number
  delta: number
}
interface TopPlayer {
  name: string
  position: string | null
  adp: number
}
interface MoversResponse {
  movers: Mover[]
  top: TopPlayer[]
  historyDays: number
}

const REFRESH_MS = 10 * 60_000
// T-90: faster than the ADP refresh — during Game Day, scores actually move
// on this cadence. Matches SystemBar's poll interval for the same endpoint.
const GAME_DAY_REFRESH_MS = 60_000

function tickerName(name: string): string {
  const parts = name.split(' ')
  if (parts.length < 2) return name.toUpperCase()
  return `${parts[0][0]}.${parts.slice(1).join(' ')}`.toUpperCase()
}

function gameLabel(g: LiveGameScore): string {
  const clock = g.statusState === 'post' ? 'FINAL' : `Q${g.period} ${g.displayClock}`
  return `${g.awayTeam} ${g.awayScore} — ${g.homeTeam} ${g.homeScore} · ${clock}`
}

export default function TickerBar() {
  const [data, setData] = useState<MoversResponse | null>(null)
  const [rostiroState, setRostiroState] = useState<RostiroState | null>(null)
  const [liveScores, setLiveScores] = useState<LiveGameScore[]>([])
  const [scoresGated, setScoresGated] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const res = await fetch('/api/adp/movers')
        if (!res.ok) return
        const body: MoversResponse = await res.json()
        if (!cancelled) setData(body)
      } catch {
        // Ticker is ambient garnish — a failed fetch just leaves it static.
      }
    }
    load()
    const t = setInterval(load, REFRESH_MS)
    return () => {
      cancelled = true
      clearInterval(t)
    }
  }, [])

  // T-90: same endpoint SystemBar polls — this is the ticker's own
  // independent fetch, matching the "each consumer polls on its own" pattern
  // already used by Pulse (see its comment on /api/system/status).
  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const res = await fetch('/api/system/status')
        if (!res.ok) return
        const body: { rostiroState: RostiroState; liveScores: LiveGameScore[]; scoresGated: boolean } = await res.json()
        if (cancelled) return
        setRostiroState(body.rostiroState)
        setLiveScores(body.liveScores ?? [])
        setScoresGated(body.scoresGated ?? false)
      } catch {
        // Same degrade-quietly posture — a failed poll just leaves the
        // ticker on whatever it last knew (ADP content or stale scores).
      }
    }
    load()
    const t = setInterval(load, GAME_DAY_REFRESH_MS)
    return () => {
      cancelled = true
      clearInterval(t)
    }
  }, [])

  // Games that have actually kicked off — a scheduled-but-not-started game
  // shows nothing here rather than a fake "0-0" (same rule as SystemBar's
  // live badge). Unfiltered by roster relevance: the ticker crawls every
  // live game today, same public-market character as its ADP content.
  const liveGames = liveScores.filter((g) => g.statusState !== 'pre')
  const gameDayActive = rostiroState === 'game_day' && liveGames.length > 0

  const segments: React.ReactNode[] = []
  if (gameDayActive) {
    liveGames.forEach((g) => {
      segments.push(
        <span
          key={g.gameId}
          style={{ color: 'var(--t1)', filter: scoresGated ? 'blur(4px)' : 'none' }}
        >
          {gameLabel(g)}
        </span>
      )
    })
    if (scoresGated) {
      segments.push(
        <span key="gated-tail" style={{ color: 'var(--signal)' }}>
          UNLOCK LIVE SCORES WITH PRO
        </span>
      )
    }
  } else if (data) {
    if (data.movers.length > 0) {
      data.movers.forEach((m, i) => {
        segments.push(
          <span key={`m${i}`} style={{ color: 'var(--t2)' }}>
            <b style={{ color: 'var(--t1)', fontWeight: 600 }}>{tickerName(m.name)}</b>{' '}
            <span style={{ color: m.delta > 0 ? 'var(--live)' : 'var(--crit)' }}>
              {m.delta > 0 ? '▲' : '▼'} {Math.abs(m.delta)}
            </span>
          </span>
        )
      })
      segments.push(
        <span key="mtail" style={{ color: 'var(--t3)' }}>
          {data.historyDays}-DAY ADP WINDOW · BOARD REFRESHES 09:00 UTC
        </span>
      )
    } else if (data.top.length > 0) {
      data.top.forEach((p, i) => {
        segments.push(
          <span key={`t${i}`} style={{ color: 'var(--t2)' }}>
            <b style={{ color: 'var(--t1)', fontWeight: 600 }}>{tickerName(p.name)}</b>{' '}
            <span style={{ color: 'var(--t3)' }}>
              {p.position ?? ''} · ADP {p.adp}
            </span>
          </span>
        )
      })
      segments.push(
        <span key="ttail" style={{ color: 'var(--t3)' }}>
          ADP HISTORY · DAY {data.historyDays} OF 7 — MOVERS UNLOCK WITH A WEEK OF DATA
        </span>
      )
    }
  }
  if (segments.length === 0) {
    segments.push(
      <span key="idle" style={{ color: 'var(--t3)' }}>
        ADP BOARD REFRESHES 09:00 UTC · PULSE REBUILDS 10:00 UTC
      </span>
    )
  }

  const crawl = (
    <>
      {segments.map((seg, i) => (
        <span key={i} className="inline-flex items-center gap-[34px]">
          {seg}
          <span style={{ color: 'var(--t4)' }}>/</span>
        </span>
      ))}
    </>
  )

  return (
    <footer
      className="mono-data hidden md:flex items-center flex-shrink-0 relative z-10 overflow-hidden"
      style={{
        height: '26px',
        fontSize: '10px',
        borderTop: '1px solid var(--hairline)',
        background: 'rgba(8, 15, 26, 0.8)',
        backdropFilter: 'blur(14px)',
        WebkitBackdropFilter: 'blur(14px)',
      }}
    >
      <span
        className="flex items-center gap-2 px-3.5 h-full flex-shrink-0 relative z-10 tracking-[0.1em]"
        style={{
          color: 'var(--t3)',
          borderRight: '1px solid var(--hairline)',
          background: 'rgba(8, 15, 26, 0.9)',
        }}
      >
        <span
          className="breathe w-[5px] h-[5px] rounded-full"
          style={{ backgroundColor: 'var(--live)', boxShadow: '0 0 6px var(--live)' }}
        />
        LIVE
      </span>
      <div className="ticker-pause flex-1 overflow-hidden relative h-full">
        <div className="ticker-crawl absolute flex items-center gap-[34px] h-full whitespace-nowrap pl-5">
          {crawl}
          {crawl}
        </div>
      </div>
    </footer>
  )
}
