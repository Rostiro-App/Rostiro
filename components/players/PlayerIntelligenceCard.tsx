'use client'

// T-89: Player Intelligence Card (PRD 6.11). Mounted once in AppShell,
// opened from anywhere via the 'rostiro:open-player-card' event (same
// pattern as CommandPalette's own 'rostiro:open-command-palette') — keeps
// the trigger (⌘K player search) decoupled from this component's own
// fetch/render lifecycle.

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useFocusTrap } from '@/lib/useFocusTrap'
import { playerPhotoUrl, teamLogoUrl } from '@/lib/playerImages'
import { sleeperLeagueUrl, espnLeagueUrl, yahooLeagueUrl } from '@/lib/leagueLinks'

type Platform = 'sleeper' | 'espn' | 'yahoo'
type Status = 'mine' | 'rostered_elsewhere' | 'free_agent' | 'waivers' | 'unknown'
type Freshness = 'fresh' | 'stale' | 'unavailable' | 'unsupported' | 'approval_pending'

// P3.5-1: previously declared in this file as 'none'/'lineup'/'waiver' but
// never rendered — kept for type-shape parity with the API response, but
// this UI never shows it directly; see navigationLabel below for why
// navigation (a real deep link) and write-capability are deliberately
// separate concerns, same distinction already established for Pulse
// (app/(dashboard)/pulse/page.tsx's navigationLabel).
type ActionCapability = 'none' | 'lineup' | 'waiver'

interface Availability {
  leagueId: string
  leagueName: string
  status: Status
  isStarter: boolean
  platform: Platform
  freshness: Freshness
  actionCapability: ActionCapability
  // Present only when THIS league's roster/waiver match came from a raw
  // source-ID comparison rather than a canonical cross-platform link —
  // i.e. this player isn't cross-linked in this specific league yet, even
  // if resolved elsewhere. Never silently dropped — see unresolvedNote.
  unresolvedSourcePlayerId: string | null
  // Real external provider league ID (a Sleeper league ID, an ESPN
  // leagueId, etc.) — used only to build a real "go view your league"
  // deep link via lib/leagueLinks.ts. Never a Rostiro-internal UUID.
  externalLeagueId: string
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

const STATUS_LABEL: Record<Status, string> = {
  mine: 'On your roster',
  rostered_elsewhere: 'Rostered by another team',
  free_agent: 'Free agent',
  waivers: 'On waivers',
  unknown: 'Unknown',
}

const STATUS_COLOR: Record<Status, string> = {
  mine: 'var(--signal)',
  rostered_elsewhere: 'var(--t3)',
  free_agent: 'var(--live)',
  waivers: 'var(--warn)',
  unknown: 'var(--t3)',
}

const PLATFORM_LABEL: Record<Platform, string> = {
  sleeper: 'SLEEPER',
  espn: 'ESPN',
  yahoo: 'YAHOO',
}

// P3.5-1: honest, human copy for a per-league freshness state — never a
// raw enum value. Mirrors app/(dashboard)/pulse/page.tsx's freshnessLabel
// so the same freshness state reads identically across Pulse and Player
// Intelligence.
function freshnessLabel(freshness: Freshness): string | null {
  switch (freshness) {
    case 'fresh': return null // the common case — no extra label needed
    case 'stale': return 'Stale — may not reflect recent moves'
    case 'unavailable': return 'Data unavailable right now'
    case 'unsupported': return 'Not supported for this platform'
    case 'approval_pending': return 'Pending platform approval'
    default: return null
  }
}

// A source-specific note for a player who isn't yet cross-linked in THIS
// league — never the raw canonical/provider ID, just an honest signal so
// an unresolved identity stays visible rather than silently merged/hidden.
function unresolvedNote(a: Availability): string | null {
  return a.unresolvedSourcePlayerId ? 'Not yet cross-linked in this league' : null
}

// P3.5-1: navigation destination (does a real link exist to click
// through to?) is a SEPARATE question from write capability (can Rostiro
// itself take an action there?) — every adapter's write capability is
// 'none' today, so a label driven by actionCapability would always read
// "Advice only," even for a league Rostiro can genuinely deep-link to.
// This function governs ONLY the clickable link's own text, driven by
// whether a real externalLeagueId exists, never by actionCapability —
// same discipline as Pulse's navigationLabel.
function leagueDeepLink(platform: Platform, externalLeagueId: string): string | null {
  if (!externalLeagueId) return null
  if (platform === 'sleeper') return sleeperLeagueUrl(externalLeagueId)
  if (platform === 'espn') return espnLeagueUrl(externalLeagueId)
  if (platform === 'yahoo') return yahooLeagueUrl(externalLeagueId)
  return null
}

function navigationLabel(platform: Platform): string {
  return `Review on ${PLATFORM_LABEL[platform]} →`
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

            <div className="flex items-center gap-3.5 mt-2.5">
              <PlayerPhoto playerId={data.player.playerId} name={data.player.name} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h2 className="text-[19px] font-semibold truncate" style={{ color: 'var(--t1)' }}>{data.player.name}</h2>
                  {data.player.nflTeam && (
                    // Onerror hides a missing logo entirely rather than showing
                    // a broken-image icon — team abbreviations we don't have a
                    // mapping quirk for (rare) just fall back to text-only.
                    <img
                      src={teamLogoUrl(data.player.nflTeam)}
                      alt=""
                      className="w-5 h-5 flex-shrink-0"
                      onError={(e) => { e.currentTarget.style.display = 'none' }}
                    />
                  )}
                </div>
                <p className="mono-data text-[10.5px] mt-0.5" style={{ color: 'var(--t3)' }}>
                  {data.player.position} · {data.player.nflTeam || 'FA'}
                  {data.player.adpSleeper !== null ? ` · ADP ${Math.round(data.player.adpSleeper)}` : ''}
                  {data.player.depthChartOrder !== null ? ` · Depth #${data.player.depthChartOrder}` : ''}
                </p>
                {data.player.injuryStatus && (
                  <p className="mono-data text-[10.5px] mt-0.5" style={{ color: 'var(--crit)' }}>
                    {data.player.injuryStatus.toUpperCase()}
                  </p>
                )}
              </div>
            </div>

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
                {data.availability.map((a) => {
                  const freshnessNote = freshnessLabel(a.freshness)
                  const identityNote = unresolvedNote(a)
                  const deepLink = leagueDeepLink(a.platform, a.externalLeagueId)
                  return (
                    <div key={a.leagueId} className="rounded-[8px] px-2.5 py-2" style={{ border: '1px solid var(--hairline)' }}>
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span
                            className="mono-data text-[9px] px-1.5 py-0.5 rounded-[4px] flex-shrink-0"
                            style={{ color: 'var(--t3)', border: '1px solid var(--hairline)' }}
                          >
                            {PLATFORM_LABEL[a.platform]}
                          </span>
                          <span className="text-[12px] truncate" style={{ color: 'var(--t2)' }}>{a.leagueName}</span>
                        </div>
                        <span className="mono-data text-[10px] flex-shrink-0" style={{ color: STATUS_COLOR[a.status] }}>
                          {STATUS_LABEL[a.status]}{a.isStarter ? ' · STARTING' : ''}
                        </span>
                      </div>
                      {(freshnessNote || identityNote) && (
                        <p className="text-[10.5px] mt-1" style={{ color: 'var(--warn)' }}>
                          {[freshnessNote, identityNote].filter(Boolean).join(' · ')}
                        </p>
                      )}
                      <div className="flex justify-end mt-1">
                        {deepLink ? (
                          <a
                            href={deepLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="mono-data text-[10px]"
                            style={{ color: 'var(--signal)' }}
                          >
                            {navigationLabel(a.platform)}
                          </a>
                        ) : (
                          <span className="mono-data text-[10px]" style={{ color: 'var(--t3)' }}>Advice only</span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </>
        )}
      </div>
    </div>,
    document.body
  )
}

// Falls back to an initials badge on a failed image load (a very recently
// signed player Sleeper's CDN hasn't caught up on yet) rather than a
// broken-image icon — tracked via local state since onError needs to
// swap the rendered element, not just hide it.
function PlayerPhoto({ playerId, name }: { playerId: string; name: string }) {
  const [failed, setFailed] = useState(false)
  const initials = name.split(' ').map((w) => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase()

  if (failed) {
    return (
      <div
        className="w-14 h-14 rounded-full flex items-center justify-center flex-shrink-0 mono-data text-[15px] font-semibold"
        style={{ backgroundColor: 'var(--signal-dim)', color: 'var(--signal)' }}
      >
        {initials}
      </div>
    )
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element -- external CDN, not a local/optimizable asset
    <img
      src={playerPhotoUrl(playerId)}
      alt={name}
      className="w-14 h-14 rounded-full flex-shrink-0 object-cover"
      style={{ backgroundColor: 'var(--glass-solid)', border: '1px solid var(--hairline)' }}
      onError={() => setFailed(true)}
    />
  )
}
