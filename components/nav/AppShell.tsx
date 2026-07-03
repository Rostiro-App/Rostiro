'use client'

import { createContext, useContext, useSyncExternalStore } from 'react'
import Sidebar from './Sidebar'
import BottomNav from './BottomNav'
import SystemBar from './SystemBar'

export type Mode = 'focused' | 'balanced' | 'savant'

export const ModeContext = createContext<Mode>('balanced')
export const useMode = () => useContext(ModeContext)

// Mode lives in localStorage (until T-71 moves the source of truth to the
// users table) — read via useSyncExternalStore so React handles the
// server/client mismatch itself: SSR renders the default, hydration swaps in
// the stored value, and the 'storage' listener keeps multiple tabs in sync.
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

export default function AppShell({ children }: { children: React.ReactNode }) {
  const mode = useSyncExternalStore(subscribeToMode, readMode, () => 'balanced' as Mode)

  function handleModeChange(next: Mode) {
    localStorage.setItem(MODE_KEY, next)
    window.dispatchEvent(new Event(MODE_EVENT))
  }

  return (
    <ModeContext.Provider value={mode}>
      <div className="flex flex-col h-screen overflow-hidden" style={{ backgroundColor: '#0D1B2A' }}>
        {/* T-67: OS Shell system bar — full width, above everything, both
            breakpoints. Replaces the old mobile-only header. */}
        <SystemBar mode={mode} onModeChange={handleModeChange} />

        <div className="flex flex-1 min-h-0">
          {/* Desktop sidebar — hidden on mobile */}
          <div className="hidden md:flex">
            <Sidebar />
          </div>

          {/* Main area */}
          <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
            {/* Page content */}
            <main className="flex-1 overflow-y-auto pb-16 md:pb-0" style={{ backgroundColor: '#0D1B2A' }}>
              {children}
            </main>

            {/* Mobile bottom nav — hidden on desktop */}
            <div className="md:hidden">
              <BottomNav mode={mode} onModeChange={handleModeChange} />
            </div>
          </div>
        </div>
      </div>
    </ModeContext.Provider>
  )
}

export function ModeButton({ mode, onClick }: { mode: Mode; onClick: () => void }) {
  const labels: Record<Mode, string> = { focused: 'Focused', balanced: 'Balanced', savant: 'Savant' }
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full transition-all"
      style={{ backgroundColor: '#378ADD22', color: '#378ADD', border: '1px solid #378ADD44' }}
    >
      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#378ADD' }} />
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
      style={{ backgroundColor: '#00000080' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-2xl p-5"
        style={{ backgroundColor: '#0F2235', border: '1.5px solid #1A3048' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <p className="text-white font-semibold">Switch mode</p>
          <button onClick={onClose} className="text-sm" style={{ color: '#5A7A9A' }}>✕</button>
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
                  backgroundColor: isActive ? '#378ADD22' : '#0A1520',
                  border: `1.5px solid ${isActive ? '#378ADD' : '#1A3048'}`,
                }}
              >
                <div className="flex items-center justify-between">
                  <span className="text-white text-sm font-medium">{m.label}</span>
                  {isActive && (
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: '#378ADD' }} />
                  )}
                </div>
                <span className="text-xs" style={{ color: '#5A7A9A' }}>{m.tagline}</span>
              </button>
            )
          })}
        </div>
        <p className="text-xs mt-4 text-center" style={{ color: '#3A5A7A' }}>
          Changes how every screen shows data.
        </p>
      </div>
    </div>
  )
}
