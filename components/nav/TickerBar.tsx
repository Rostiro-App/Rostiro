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

function tickerName(name: string): string {
  const parts = name.split(' ')
  if (parts.length < 2) return name.toUpperCase()
  return `${parts[0][0]}.${parts.slice(1).join(' ')}`.toUpperCase()
}

export default function TickerBar() {
  const [data, setData] = useState<MoversResponse | null>(null)

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

  const segments: React.ReactNode[] = []
  if (data) {
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
