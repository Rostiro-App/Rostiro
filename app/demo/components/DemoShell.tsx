'use client'
import { useMemo, type ReactNode } from 'react'
import PulseMark from '@/components/PulseMark'
import { useDemoOptional } from '../lib/DemoStateProvider'
import { demoHealth } from '../lib/demoHealth'
import { loadFixtures } from '../lib/loadFixtures'
import type { RostiroState } from '@/types'

// Reproduces the real Rostiro OS chrome (SystemBar + icon dock + Bloomberg
// ticker) using the shared globals.css design tokens — visually faithful but
// fully self-contained: no /api polls, no navigation, fixture-fed. Reuses the
// production PulseMark so the waveform reacts to the demo's current state.

const NAV: { label: string; active?: boolean; icon: ReactNode }[] = [
  { label: 'Pulse', active: true, icon: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" /></svg>
  ) },
  { label: 'Leagues', icon: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></svg>
  ) },
  { label: 'Draft Kit', icon: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="9" y1="13" x2="15" y2="13" /><line x1="9" y1="17" x2="13" y2="17" /></svg>
  ) },
  { label: 'Lineups', icon: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 00-3-3.87" /><path d="M16 3.13a4 4 0 010 7.75" /></svg>
  ) },
  { label: 'Trades', icon: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="17 1 21 5 17 9" /><path d="M3 11V9a4 4 0 014-4h14" /><polyline points="7 23 3 19 7 15" /><path d="M21 13v2a4 4 0 01-4 4H3" /></svg>
  ) },
]

function tickerName(name: string): string {
  const parts = name.split(' ')
  if (parts.length < 2) return name.toUpperCase()
  return `${parts[0][0]}.${parts.slice(1).join(' ')}`.toUpperCase()
}

function DemoSidebar() {
  return (
    <aside
      className="hidden md:flex w-[52px] flex-col items-center h-full flex-shrink-0 py-3.5 gap-1.5 relative z-10"
      style={{ borderRight: '1px solid var(--hairline)', background: 'rgba(8, 15, 26, 0.5)', backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)' }}
    >
      {NAV.map((item) => (
        <span key={item.label} className="relative group">
          {item.active && (
            <span className="absolute -left-2 top-1/2 -translate-y-1/2 w-[2.5px] h-4 rounded-full" style={{ backgroundColor: 'var(--signal)', boxShadow: '0 0 8px var(--signal)' }} />
          )}
          <span
            aria-label={item.label}
            className="flex items-center justify-center w-9 h-9 rounded-[10px] transition-all"
            style={item.active
              ? { color: 'var(--signal)', backgroundColor: 'var(--signal-dim)', boxShadow: '0 0 18px rgba(75,163,245,.22), inset 0 0 0 1px rgba(75,163,245,.3)' }
              : { color: 'var(--t3)' }}
          >
            {item.icon}
          </span>
        </span>
      ))}
      <span className="relative group">
        <span aria-label="LIVE" className="flex items-center justify-center w-9 h-9 rounded-[10px]" style={{ color: 'var(--t4)', opacity: 0.4 }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" /></svg>
        </span>
      </span>
      <span className="flex-1" />
      <span aria-label="Profile" className="flex items-center justify-center w-9 h-9 rounded-[10px]" style={{ color: 'var(--t3)' }}>
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
      </span>
      <span aria-label="Settings" className="flex items-center justify-center w-9 h-9 rounded-[10px]" style={{ color: 'var(--t3)' }}>
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" /></svg>
      </span>
    </aside>
  )
}

function DemoSystemBar({ score, state, sweeping }: { score: number | null; state: RostiroState; sweeping?: boolean }) {
  return (
    <div
      className={`glass-bar mono-data flex items-center gap-3 md:gap-5 px-3 md:px-4 flex-shrink-0 relative z-20 ${sweeping ? 'kickoff-sweep' : ''}`.trim()}
      style={{ borderBottom: '1px solid var(--hairline)', height: '42px', fontSize: '11px' }}
    >
      <span className="hidden md:flex items-center gap-2.5 flex-shrink-0">
        <PulseMark state={state} playoffTier="none" />
        <span aria-hidden="true" style={{ width: 1, height: 14, backgroundColor: 'var(--hairline)' }} />
        <span className="flex items-baseline gap-1.5">
          <span className="font-bold tracking-[0.18em] text-[11.5px]" style={{ color: 'var(--t1)' }}>ROSTIRO</span>
          <span className="text-[8.5px] font-bold tracking-[0.14em] px-1 rounded" style={{ color: 'var(--signal)', border: '1px solid rgba(75,163,245,0.45)', textShadow: '0 0 12px rgba(75,163,245,0.65)' }}>OS</span>
        </span>
      </span>

      <span className="flex items-center gap-2 flex-shrink-0" style={{ color: 'var(--t2)' }}>
        <span className="ping-dot w-1.5 h-1.5 rounded-full" style={{ color: 'var(--live)', backgroundColor: 'var(--live)', boxShadow: '0 0 8px rgba(67,192,119,.8)' }} />
        <span className="hidden sm:inline">SYNCED 5S AGO</span>
      </span>

      <span className="flex items-center gap-2.5">
        <span className="hidden md:inline text-[9px] tracking-[0.14em]" style={{ color: 'var(--t3)' }}>LEAGUES</span>
        <span className="relative flex items-center gap-1.5">
          <span className="breathe block w-2 h-2 rounded-full" style={{ backgroundColor: 'var(--live)', boxShadow: '0 0 7px rgba(67,192,119,.7)' }} />
          <span className="text-[10px]" style={{ color: 'var(--t3)' }} data-testid="health-score">{score ?? '—'}</span>
        </span>
      </span>

      <span className="flex-1" />

      <span className="text-[8.5px] font-bold tracking-[0.14em] px-1.5 py-0.5 rounded flex-shrink-0" style={{ color: '#0D0800', backgroundColor: '#F5C842', boxShadow: '0 0 12px rgba(245,200,66,0.7)' }}>★ FOUNDER</span>

      <span className="flex items-center gap-1.5 text-[10px] tracking-[0.06em] px-2.5 py-[3px] rounded-full flex-shrink-0" style={{ backgroundColor: 'var(--signal-dim)', color: 'var(--signal)', border: '1px solid rgba(75,163,245,0.35)' }}>
        <span className="w-[5px] h-[5px] rounded-full" style={{ backgroundColor: 'var(--signal)' }} />BALANCED
      </span>

      <span className="hidden sm:flex items-center gap-1.5 text-[10px] px-2 py-[3px] rounded-md flex-shrink-0" style={{ color: 'var(--t3)', border: '1px solid var(--hairline)' }}>
        Command <span className="px-1 rounded" style={{ color: 'var(--t2)', backgroundColor: 'rgba(90,150,210,.12)' }}>⌘K</span>
      </span>
    </div>
  )
}

function DemoTicker() {
  const { players } = useMemo(() => loadFixtures(), [])
  const board = useMemo(
    () => players.filter((p) => p.adp != null).sort((a, b) => a.adp! - b.adp!).slice(0, 14),
    [players],
  )
  const crawl = (
    <>
      {board.map((p, i) => (
        <span key={i} className="inline-flex items-center gap-[34px]">
          <span style={{ color: 'var(--t2)' }}>
            <b style={{ color: 'var(--t1)', fontWeight: 600 }}>{tickerName(p.name)}</b>{' '}
            <span style={{ color: 'var(--t3)' }}>{p.pos} · ADP {p.adp}</span>
          </span>
          <span style={{ color: 'var(--t4)' }}>/</span>
        </span>
      ))}
    </>
  )
  return (
    <footer className="mono-data hidden md:flex items-center flex-shrink-0 relative z-10 overflow-hidden" style={{ height: '26px', fontSize: '10px', borderTop: '1px solid var(--hairline)', background: 'rgba(8, 15, 26, 0.8)', backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)' }}>
      <span className="flex items-center gap-2 px-3.5 h-full flex-shrink-0 relative z-10 tracking-[0.1em]" style={{ color: 'var(--t3)', borderRight: '1px solid var(--hairline)', background: 'rgba(8, 15, 26, 0.9)' }}>
        <span className="breathe w-[5px] h-[5px] rounded-full" style={{ backgroundColor: 'var(--live)', boxShadow: '0 0 6px var(--live)' }} />LIVE
      </span>
      <div className="ticker-pause flex-1 overflow-hidden relative h-full">
        <div className="ticker-crawl absolute flex items-center gap-[34px] h-full whitespace-nowrap pl-5" aria-hidden="true">
          {crawl}{crawl}
        </div>
      </div>
    </footer>
  )
}

export function DemoShell({
  children,
  variant = 'route',
  stateOverride,
  sweeping,
  score: scoreProp,
}: {
  children: ReactNode
  variant?: 'route' | 'contained'
  stateOverride?: RostiroState
  sweeping?: boolean
  score?: number | null
}) {
  const ctx = useDemoOptional()
  const state: RostiroState = stateOverride ?? ctx?.state.currentState ?? 'standard'
  const computed = useMemo(() => demoHealth(), [])
  const score = scoreProp ?? computed.health.score
  const rootClass = variant === 'contained'
    ? 'absolute inset-0 h-full w-full flex flex-col overflow-hidden'
    : 'flex flex-col h-screen overflow-hidden relative'
  return (
    <div className={rootClass} style={{ backgroundColor: 'var(--void)' }}>
      <div className="ambient-ground" aria-hidden="true" />
      <DemoSystemBar score={score} state={state} sweeping={sweeping} />
      <div className="flex flex-1 min-h-0 relative z-10">
        <DemoSidebar />
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
          <main className="flex-1 overflow-y-auto">{children}</main>
        </div>
      </div>
      <DemoTicker />
    </div>
  )
}
