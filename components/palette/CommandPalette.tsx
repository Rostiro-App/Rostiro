'use client'

// T-70: Command palette (PRD 6.7 W4). ⌘K on desktop, floating action button
// on mobile, plus the system bar's ⌘K chip (which dispatches
// 'rostiro:open-command-palette'). Three command sources, built as provider
// functions over a shared Command shape so future features add commands
// without touching the palette internals:
//   1. navigation + mode switching (static)
//   2. live Pulse items — open decisions become jumpable commands
//   3. player search against /api/draft/players (cached per mount)

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Mode } from '@/components/nav/AppShell'
import type { ADPPlayer, PulseItem } from '@/types'

interface Command {
  id: string
  section: 'Navigate' | 'Mode' | 'Pulse' | 'Players'
  label: string
  hint: string | null
  run: () => void
}

const NAV_TARGETS = [
  { label: 'Pulse', href: '/pulse' },
  { label: 'Leagues', href: '/leagues' },
  { label: 'Draft Kit', href: '/draft' },
  { label: 'Lineups', href: '/lineup' },
  { label: 'Trades', href: '/trades' },
  { label: 'Settings', href: '/settings' },
]

const MODE_LABELS: Record<Mode, string> = {
  focused: 'Focused',
  balanced: 'Balanced',
  savant: 'Savant',
}

// Pulse items are re-fetched at most this often across palette opens —
// each fetch triggers a full build+sync server-side, so don't hammer it.
const PULSE_CACHE_MS = 60_000

// T-105 / PRD 3: Focused gets a shorter, faster-to-scan result list;
// Savant gets more options up front instead of needing a narrower query.
const MAX_PLAYER_RESULTS: Record<Mode, number> = { focused: 4, balanced: 6, savant: 9 }

export default function CommandPalette({
  mode,
  onModeChange,
}: {
  mode: Mode
  onModeChange: (m: Mode) => void
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState(0)
  const [pulseItems, setPulseItems] = useState<PulseItem[]>([])
  const [players, setPlayers] = useState<ADPPlayer[]>([])
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const playersRequested = useRef(false)
  const pulseFetchedAt = useRef(0)

  const openPalette = useCallback(() => {
    setOpen(true)
    setQuery('')
    setSelected(0)

    if (Date.now() - pulseFetchedAt.current > PULSE_CACHE_MS) {
      pulseFetchedAt.current = Date.now()
      fetch('/api/pulse/sleeper')
        .then((res) => (res.ok ? res.json() : null))
        .then((data: { items: PulseItem[] } | null) => {
          if (data) setPulseItems(data.items)
        })
        .catch(() => {})
    }

    if (!playersRequested.current) {
      playersRequested.current = true
      fetch('/api/draft/players')
        .then((res) => (res.ok ? res.json() : null))
        .then((data: { players: ADPPlayer[] } | null) => {
          if (data) setPlayers(data.players)
        })
        .catch(() => {
          playersRequested.current = false
        })
    }
  }, [])

  // Open triggers: ⌘K / Ctrl+K anywhere, or the system bar chip's event.
  // ⌘1–5 jump straight to a panel (the dock tooltips advertise these).
  useEffect(() => {
    const PANEL_KEYS = ['/pulse', '/leagues', '/draft', '/lineup', '/trades']
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        openPalette()
        return
      }
      if ((e.metaKey || e.ctrlKey) && e.key >= '1' && e.key <= '5') {
        e.preventDefault()
        router.push(PANEL_KEYS[Number(e.key) - 1])
      }
    }
    function onOpenEvent() {
      openPalette()
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('rostiro:open-command-palette', onOpenEvent)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('rostiro:open-command-palette', onOpenEvent)
    }
  }, [openPalette, router])

  useEffect(() => {
    if (open) inputRef.current?.focus()
  }, [open])

  function close() {
    setOpen(false)
  }

  function go(href: string) {
    close()
    router.push(href)
  }

  // ─── Command sources ───────────────────────────────────────────────────────
  const q = query.trim().toLowerCase()
  const commands: Command[] = []

  for (const nav of NAV_TARGETS) {
    if (q && !nav.label.toLowerCase().includes(q)) continue
    commands.push({
      id: `nav:${nav.href}`,
      section: 'Navigate',
      label: nav.label,
      hint: null,
      run: () => go(nav.href),
    })
  }

  for (const m of Object.keys(MODE_LABELS) as Mode[]) {
    if (m === mode) continue
    const label = `Switch to ${MODE_LABELS[m]}`
    if (q && !label.toLowerCase().includes(q)) continue
    commands.push({
      id: `mode:${m}`,
      section: 'Mode',
      label,
      hint: 'Changes how every screen shows data',
      run: () => {
        onModeChange(m)
        close()
      },
    })
  }

  for (const item of pulseItems) {
    if (q && !item.headline.toLowerCase().includes(q)) continue
    commands.push({
      id: `pulse:${item.id}`,
      section: 'Pulse',
      label: item.headline,
      hint: item.affectedLeagues[0]?.leagueName ?? null,
      run: () => go('/pulse'),
    })
  }

  if (q.length >= 2) {
    const matches = players
      .filter((p) => p.name.toLowerCase().includes(q))
      .slice(0, MAX_PLAYER_RESULTS[mode])
    for (const p of matches) {
      commands.push({
        id: `player:${p.playerId}`,
        section: 'Players',
        label: p.name,
        hint: `${p.position} · ${p.nflTeam || 'FA'} · ADP ${Math.round(p.adpConsensus)}`,
        run: () => go(`/draft?q=${encodeURIComponent(p.name)}`),
      })
    }
  }

  const clampedSelected = Math.min(selected, Math.max(0, commands.length - 1))

  function onInputKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelected((s) => Math.min(s + 1, commands.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelected((s) => Math.max(s - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      commands[clampedSelected]?.run()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      close()
    }
  }

  // Keep the selected row in view while arrowing through a long list.
  useEffect(() => {
    listRef.current
      ?.querySelector(`[data-index="${clampedSelected}"]`)
      ?.scrollIntoView({ block: 'nearest' })
  }, [clampedSelected])

  return (
    <>
      {/* Mobile FAB — thumb-reachable palette trigger, above the bottom nav */}
      {!open && (
        <button
          type="button"
          aria-label="Open command palette"
          onClick={openPalette}
          className="md:hidden fixed z-40 flex items-center justify-center rounded-full"
          style={{
            right: 16,
            bottom: 'calc(76px + env(safe-area-inset-bottom))',
            width: 48,
            height: 48,
            backgroundColor: 'rgba(12, 24, 40, 0.85)',
            border: '1px solid rgba(75,163,245,.45)',
            boxShadow: '0 8px 24px rgba(0,0,0,.5), 0 0 18px rgba(75,163,245,.25)',
            backdropFilter: 'blur(14px)',
            WebkitBackdropFilter: 'blur(14px)',
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--signal)" strokeWidth="2" strokeLinecap="round">
            <circle cx="11" cy="11" r="7" />
            <line x1="21" y1="21" x2="16.5" y2="16.5" />
          </svg>
        </button>
      )}

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center px-4 pt-[14vh]"
          style={{
            backgroundColor: 'rgba(3, 7, 13, 0.45)',
            backdropFilter: 'blur(6px)',
            WebkitBackdropFilter: 'blur(6px)',
          }}
          onClick={close}
        >
          <div
            className="glass-heavy panel-enter w-full max-w-[560px] rounded-[15px] overflow-hidden flex flex-col"
            style={{
              maxHeight: '60vh',
              boxShadow: '0 30px 90px rgba(0,0,0,.6), 0 0 50px rgba(75,163,245,.10)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Input */}
            <div className="flex items-center gap-3 px-[18px] py-3.5" style={{ borderBottom: '1px solid var(--hairline)' }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--t3)" strokeWidth="2" strokeLinecap="round">
                <circle cx="11" cy="11" r="7" />
                <line x1="21" y1="21" x2="16.5" y2="16.5" />
              </svg>
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value)
                  setSelected(0)
                }}
                onKeyDown={onInputKeyDown}
                placeholder="Jump anywhere — pages, decisions, players…"
                className="flex-1 bg-transparent text-[14.5px] outline-none"
                style={{ color: 'var(--t1)' }}
              />
              <kbd
                className="mono-data hidden md:inline text-[9.5px] px-1.5 py-0.5 rounded"
                style={{ color: 'var(--t3)', border: '1px solid var(--hairline)', borderBottomWidth: '2px' }}
              >
                ESC
              </kbd>
            </div>

            {/* Results */}
            <div ref={listRef} className="flex-1 overflow-y-auto py-2">
              {commands.length === 0 && (
                <p className="text-[12.5px] text-center py-6" style={{ color: 'var(--t3)' }}>
                  No matches{q.length === 1 ? ' — keep typing for player search' : ''}.
                </p>
              )}
              {commands.map((cmd, i) => {
                const isFirstOfSection = i === 0 || commands[i - 1].section !== cmd.section
                const isSelected = i === clampedSelected
                return (
                  <div key={cmd.id}>
                    {isFirstOfSection && (
                      <p
                        className="mono-data px-[18px] pt-2.5 pb-1 text-[8.5px] tracking-[0.18em] uppercase"
                        style={{ color: 'var(--t3)' }}
                      >
                        {cmd.section}
                      </p>
                    )}
                    <button
                      type="button"
                      data-index={i}
                      onClick={cmd.run}
                      onMouseMove={() => setSelected(i)}
                      className="w-full flex items-center justify-between gap-3 px-[18px] py-2 text-left"
                      style={{
                        backgroundColor: isSelected ? 'var(--signal-dim)' : 'transparent',
                        borderLeft: `2px solid ${isSelected ? 'var(--signal)' : 'transparent'}`,
                      }}
                    >
                      <span
                        className="text-[13px] truncate"
                        style={{ color: isSelected ? 'var(--t1)' : 'var(--t2)' }}
                      >
                        {cmd.label}
                      </span>
                      {cmd.hint && (
                        <span
                          className="mono-data text-[10px] flex-shrink-0 truncate max-w-[45%]"
                          style={{ color: isSelected ? 'var(--signal)' : 'var(--t3)' }}
                        >
                          {cmd.hint}
                        </span>
                      )}
                    </button>
                  </div>
                )
              })}
            </div>

            {/* Footer hints */}
            <div
              className="mono-data flex gap-4 px-[18px] py-2 text-[9.5px]"
              style={{ borderTop: '1px solid var(--hairline)', color: 'var(--t3)' }}
            >
              <span>↑↓ NAVIGATE</span>
              <span>↵ RUN</span>
              <span className="hidden md:inline">⌘1–5 PANELS</span>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
