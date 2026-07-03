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
const MAX_PLAYER_RESULTS = 6

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
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        openPalette()
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
  }, [openPalette])

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
      .slice(0, MAX_PLAYER_RESULTS)
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
          className="md:hidden fixed z-40 flex items-center justify-center rounded-full shadow-lg"
          style={{
            right: 16,
            bottom: 'calc(76px + env(safe-area-inset-bottom))',
            width: 48,
            height: 48,
            backgroundColor: '#185FA5',
            border: '1px solid #378ADD55',
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round">
            <circle cx="11" cy="11" r="7" />
            <line x1="21" y1="21" x2="16.5" y2="16.5" />
          </svg>
        </button>
      )}

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center px-4 pt-[15vh]"
          style={{ backgroundColor: '#000000A0' }}
          onClick={close}
        >
          <div
            className="w-full max-w-lg rounded-2xl overflow-hidden flex flex-col"
            style={{ backgroundColor: '#0F2235', border: '1.5px solid #1A3048', maxHeight: '60vh' }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Input */}
            <div className="flex items-center gap-2.5 px-4 py-3" style={{ borderBottom: '1px solid #1A3048' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#5A7A9A" strokeWidth="2" strokeLinecap="round">
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
                placeholder="Search pages, players, or your Pulse…"
                className="flex-1 bg-transparent text-sm text-white outline-none placeholder:text-[#3A5A7A]"
              />
              <kbd
                className="hidden md:inline text-[10px] font-semibold px-1.5 py-0.5 rounded"
                style={{ color: '#3A5A7A', border: '1px solid #1A3048' }}
              >
                ESC
              </kbd>
            </div>

            {/* Results */}
            <div ref={listRef} className="flex-1 overflow-y-auto py-2">
              {commands.length === 0 && (
                <p className="text-sm text-center py-6" style={{ color: '#3A5A7A' }}>
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
                        className="px-4 pt-2 pb-1 text-[10px] font-semibold tracking-widest uppercase"
                        style={{ color: '#3A5A7A' }}
                      >
                        {cmd.section}
                      </p>
                    )}
                    <button
                      type="button"
                      data-index={i}
                      onClick={cmd.run}
                      onMouseMove={() => setSelected(i)}
                      className="w-full flex items-center justify-between gap-3 px-4 py-2 text-left"
                      style={{ backgroundColor: isSelected ? '#378ADD18' : 'transparent' }}
                    >
                      <span
                        className="text-sm truncate"
                        style={{ color: isSelected ? '#FFFFFF' : '#8AAABB' }}
                      >
                        {cmd.label}
                      </span>
                      {cmd.hint && (
                        <span className="text-xs flex-shrink-0 truncate max-w-[45%]" style={{ color: '#3A5A7A' }}>
                          {cmd.hint}
                        </span>
                      )}
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
