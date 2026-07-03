'use client'

import { createContext, useContext, useEffect, useSyncExternalStore } from 'react'
import Sidebar from './Sidebar'
import BottomNav from './BottomNav'
import SystemBar from './SystemBar'
import TickerBar from './TickerBar'
import CommandPalette from '@/components/palette/CommandPalette'

export type Mode = 'focused' | 'balanced' | 'savant'

export const ModeContext = createContext<Mode>('balanced')
export const useMode = () => useContext(ModeContext)

// T-71: the users table is the source of truth for signed-in users; mode
// follows them across devices. localStorage stays as the pre-signup cache
// and the synchronous read path — read via useSyncExternalStore so React
// handles the server/client mismatch itself: SSR renders the default,
// hydration swaps in the cached value, DB hydration corrects it if another
// device changed it, and the 'storage' listener keeps tabs in sync.
const MODE_KEY = 'rostiro_mode'
const MODE_EVENT = 'rostiro:mode-change'
const VALID_MODES: readonly Mode[] = ['focused', 'balanced', 'savant']

function subscribeToMode(callback: () => void) {
  window.addEventListener('storage', callback)
  window.addEventListener(MODE_EVENT, callback)
  return () => {
    window.removeEventListener('storage', callback)
    window.removeEventListener(MODE_EVENT, callback)
  }
}

function readMode(): Mode {
  const stored = localStorage.getItem(MODE_KEY)
  return VALID_MODES.includes(stored as Mode) ? (stored as Mode) : 'balanced'
}

// Single write path for mode: local cache + cross-tab event + best-effort DB
// persist. Exported so Settings changes mode through the exact same door.
export function setGlobalMode(next: Mode) {
  localStorage.setItem(MODE_KEY, next)
  window.dispatchEvent(new Event(MODE_EVENT))
  // Fire-and-forget: 401 (anonymous Draft Kit visitor) and 503 (mode column
  // not migrated yet) both just mean localStorage stays authoritative.
  fetch('/api/settings', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mode: next }),
  }).catch(() => {})
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const mode = useSyncExternalStore(subscribeToMode, readMode, () => 'balanced' as Mode)

  // Hydrate from the DB once per mount — if another device changed the mode,
  // the local cache catches up here.
  useEffect(() => {
    let cancelled = false
    fetch('/api/settings')
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { mode: Mode | null } | null) => {
        if (cancelled || !data?.mode || !VALID_MODES.includes(data.mode)) return
        if (data.mode !== readMode()) {
          localStorage.setItem(MODE_KEY, data.mode)
          window.dispatchEvent(new Event(MODE_EVENT))
        }
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  function handleModeChange(next: Mode) {
    setGlobalMode(next)
  }

  return (
    <ModeContext.Provider value={mode}>
      <div className="flex flex-col h-screen overflow-hidden relative" style={{ backgroundColor: 'var(--void)' }}>
        {/* OS redesign: ambient drifting glows under everything — the ground
            itself signals the system is alive. */}
        <div className="ambient-ground" aria-hidden="true" />

        {/* T-67: OS Shell system bar — full width, above everything, both
            breakpoints. */}
        <SystemBar mode={mode} onModeChange={handleModeChange} />

        {/* T-70: ⌘K palette + mobile FAB — listens for the system bar's
            'rostiro:open-command-palette' event and the keyboard shortcut. */}
        <CommandPalette mode={mode} onModeChange={handleModeChange} />

        <div className="flex flex-1 min-h-0 relative z-10">
          {/* Desktop icon dock — hidden on mobile */}
          <div className="hidden md:flex">
            <Sidebar />
          </div>

          {/* Main area */}
          <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
            {/* Page content — transparent so the ambient ground shows through */}
            <main className="flex-1 overflow-y-auto pb-16 md:pb-0">
              {children}
            </main>

            {/* Mobile bottom nav — hidden on desktop */}
            <div className="md:hidden">
              <BottomNav />
            </div>
          </div>
        </div>

        {/* Bloomberg strip — desktop only */}
        <TickerBar />
      </div>
    </ModeContext.Provider>
  )
}

export function ModeButton({ mode, onClick }: { mode: Mode; onClick: () => void }) {
  const labels: Record<Mode, string> = { focused: 'FOCUSED', balanced: 'BALANCED', savant: 'SAVANT' }
  return (
    <button
      onClick={onClick}
      className="mono-data flex items-center gap-1.5 text-[10px] tracking-[0.06em] px-2.5 py-[3px] rounded-full transition-all hover:shadow-[0_0_16px_rgba(75,163,245,0.25)]"
      style={{
        backgroundColor: 'var(--signal-dim)',
        color: 'var(--signal)',
        border: '1px solid rgba(75,163,245,0.35)',
      }}
    >
      <span className="w-[5px] h-[5px] rounded-full" style={{ backgroundColor: 'var(--signal)' }} />
      {labels[mode]}
    </button>
  )
}

export function ModeSwitcher({
  current,
  onSelect,
  onClose,
}: {
  current: Mode
  onSelect: (m: Mode) => void
  onClose: () => void
}) {
  const modes: { id: Mode; label: string; tagline: string }[] = [
    { id: 'focused', label: 'Focused', tagline: 'Just tell me what to do.' },
    { id: 'balanced', label: 'Balanced', tagline: 'Context + decisions.' },
    { id: 'savant', label: 'Savant', tagline: 'Show me everything.' },
  ]

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      style={{
        backgroundColor: 'rgba(3, 7, 13, 0.45)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
      }}
      onClick={onClose}
    >
      <div
        className="glass-heavy w-full max-w-sm rounded-2xl p-5"
        style={{ boxShadow: '0 30px 90px rgba(0,0,0,.6), 0 0 50px rgba(75,163,245,.10)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <p className="font-semibold" style={{ color: 'var(--t1)' }}>Switch mode</p>
          <button onClick={onClose} className="text-sm" style={{ color: 'var(--t3)' }}>✕</button>
        </div>
        <div className="space-y-2">
          {modes.map((m) => {
            const isActive = m.id === current
            return (
              <button
                key={m.id}
                onClick={() => onSelect(m.id)}
                className="w-full text-left rounded-xl px-4 py-3 transition-all"
                style={{
                  backgroundColor: isActive ? 'var(--signal-dim)' : 'rgba(8, 15, 26, 0.6)',
                  border: `1.5px solid ${isActive ? 'var(--signal)' : 'var(--hairline)'}`,
                  boxShadow: isActive ? '0 0 18px rgba(75,163,245,.15)' : 'none',
                }}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium" style={{ color: 'var(--t1)' }}>{m.label}</span>
                  {isActive && (
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: 'var(--signal)', boxShadow: '0 0 8px var(--signal)' }} />
                  )}
                </div>
                <span className="text-xs" style={{ color: 'var(--t2)' }}>{m.tagline}</span>
              </button>
            )
          })}
        </div>
        <p className="mono-data text-[10px] tracking-[0.08em] mt-4 text-center" style={{ color: 'var(--t3)' }}>
          CHANGES HOW EVERY SCREEN SHOWS DATA
        </p>
      </div>
    </div>
  )
}
