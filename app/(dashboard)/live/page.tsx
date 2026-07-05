'use client'

// T-111: LIVE — Rostiro's second-screen tab. Real data binding for the
// mockup verified with the founder: live roster grouped by shared game,
// per-league tags, a big-play takeover for touchdowns, a quiet pulse for
// yardage/receptions, a muted (never alarming) treatment for negatives,
// the player-updates digest, matchup rail, and window recap card.

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useWakeLock } from '@/lib/useWakeLock'
import { useIdleDim } from '@/lib/useIdleDim'
import { useLiveUnlockTransition } from '@/lib/useLiveUnlockTransition'

interface LiveGameContext {
  homeTeam: string
  awayTeam: string
  homeScore: number
  awayScore: number
  period: number
  displayClock: string
}

interface LiveRosterPlayer {
  playerId: string
  name: string
  position: string | null
  nflTeam: string | null
  points: number
  game: LiveGameContext
  leagues: { leagueId: string; leagueName: string; status: 'starting' | 'bench' }[]
}

interface LiveMatchupSummary {
  leagueId: string
  leagueName: string
  myScore: number
  opponentScore: number
}

interface LiveUpdateItem {
  pulseItemId: string
  playerId: string | null
  headline: string
  reasoning: string
  actionUrl: string | null
}

interface RecentEvent {
  player_id: string
  event_type: 'touchdown' | 'reception' | 'yardage' | 'negative'
  delta: number
  created_at: string
}

interface WindowRecap {
  id: string
  headline: string
  reasoning: string
  created_at: string
}

interface StatLine {
  label: string
  value: number
}

interface NextKickoff {
  kickoffAt: string
  homeTeam: string
  awayTeam: string
  label: string
}

interface LiveStatus {
  unlocked: boolean
  windowEndsAt: string | null
  nextKickoff: NextKickoff | null
  liveRoster: LiveRosterPlayer[]
  matchups: LiveMatchupSummary[]
  updates: LiveUpdateItem[]
  recentEvents: RecentEvent[]
  windowRecap: WindowRecap | null
}

function formatCountdown(targetIso: string, now: number): string {
  const diffMs = new Date(targetIso).getTime() - now
  if (diffMs <= 0) return 'any moment now'
  const totalMinutes = Math.floor(diffMs / 60_000)
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  if (hours === 0) return `${minutes}m`
  return `${hours}h ${minutes}m`
}

const POLL_MS_ACTIVE = 15_000
const POLL_MS_IDLE = 45_000 // battery/network backoff once no one's touched the screen in a while
const KEEP_AWAKE_KEY = 'rostiro_live_keep_awake'

function playerPhotoUrl(playerId: string): string {
  return `https://sleepercdn.com/content/nfl/players/${playerId}.jpg`
}

export default function LivePage() {
  const [status, setStatus] = useState<LiveStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [bigPlay, setBigPlay] = useState<{ player: LiveRosterPlayer; event: RecentEvent } | null>(null)
  const shownEventKeys = useRef(new Set<string>())
  const [statSheet, setStatSheet] = useState<{ player: LiveRosterPlayer; loading: boolean; lines: StatLine[] } | null>(null)
  const justUnlocked = useLiveUnlockTransition(status?.unlocked === true)
  const [clockNow, setClockNow] = useState(() => Date.now())

  // Ticks the locked-screen countdown once a second — independent of the
  // 15-45s status poll, which would otherwise make "2h 14m" visibly jump
  // in large, sporadic steps instead of counting down smoothly.
  useEffect(() => {
    if (status?.unlocked || !status?.nextKickoff) return
    const interval = setInterval(() => setClockNow(Date.now()), 1000)
    return () => clearInterval(interval)
  }, [status?.unlocked, status?.nextKickoff])

  function openStatSheet(player: LiveRosterPlayer) {
    setStatSheet({ player, loading: true, lines: [] })
    fetch(`/api/live/player-stats?playerId=${encodeURIComponent(player.playerId)}`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error('Failed to load'))))
      .then((data: { stats: StatLine[] }) => {
        setStatSheet((current) => (current && current.player.playerId === player.playerId ? { ...current, loading: false, lines: data.stats } : current))
      })
      .catch(() => {
        setStatSheet((current) => (current && current.player.playerId === player.playerId ? { ...current, loading: false, lines: [] } : current))
      })
  }
  const { idle, wake } = useIdleDim()
  const [keepAwake, setKeepAwake] = useState(false)
  const [readStorage, setReadStorage] = useState(false)

  // Adjust during render rather than in an effect — React's own documented
  // pattern for "correct state once you notice a mismatch after mount,"
  // avoiding both a synchronous-setState-in-effect cascade and a hydration
  // mismatch (server has no localStorage, so it always renders `false`;
  // this only ever runs client-side, in the same commit as hydration).
  // State, not a ref — refs can't be read during render.
  // Opt-in, never a silent default — the battery cost of hours of "screen
  // always on" is real enough that the user should choose it.
  if (!readStorage && typeof window !== 'undefined') {
    setReadStorage(true)
    const stored = localStorage.getItem(KEEP_AWAKE_KEY) === 'true'
    if (stored !== keepAwake) setKeepAwake(stored)
  }

  useWakeLock(keepAwake)

  function toggleKeepAwake() {
    setKeepAwake((current) => {
      const next = !current
      localStorage.setItem(KEEP_AWAKE_KEY, String(next))
      return next
    })
  }

  useEffect(() => {
    let cancelled = false

    function poll() {
      fetch('/api/live/status')
        .then((res) => (res.ok ? res.json() : Promise.reject(new Error('Failed to load'))))
        .then((data: LiveStatus) => {
          if (cancelled) return
          setStatus(data)

          // Fire the big-play takeover for a touchdown we haven't shown yet —
          // one at a time, never stacked, same rule as the Interrupt layer.
          const freshTouchdown = data.recentEvents.find((e) => {
            const key = `${e.player_id}:${e.created_at}`
            if (e.event_type !== 'touchdown' || shownEventKeys.current.has(key)) return false
            shownEventKeys.current.add(key)
            return true
          })
          if (freshTouchdown) {
            const player = data.liveRoster.find((p) => p.playerId === freshTouchdown.player_id)
            if (player) setBigPlay({ player, event: freshTouchdown })
          }
        })
        .catch(() => {})
        .finally(() => setLoading(false))
    }

    poll()
    // Re-armed whenever `idle` flips, so going idle immediately slows the
    // next tick rather than waiting out a stale, faster interval.
    const interval = setInterval(poll, idle ? POLL_MS_IDLE : POLL_MS_ACTIVE)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [idle])

  useEffect(() => {
    if (!bigPlay) return
    const t = setTimeout(() => setBigPlay(null), 3400)
    return () => clearTimeout(t)
  }, [bigPlay])

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 pt-6 pb-16 md:px-6 md:pt-8">
        <div className="h-40 rounded-xl animate-pulse" style={{ backgroundColor: 'rgba(8, 15, 26, 0.6)', border: '1px solid var(--hairline)' }} />
      </div>
    )
  }

  if (!status || !status.unlocked) {
    const next = status?.nextKickoff
    return (
      <div className="max-w-md mx-auto px-4 pt-24 pb-16 text-center">
        <div
          className="w-14 h-14 rounded-full mx-auto flex items-center justify-center text-xl"
          style={{ border: '1px solid var(--hairline)', color: 'var(--t4)' }}
        >
          ⚡
        </div>
        <h1 className="text-lg font-semibold text-white mt-5">LIVE opens when your players do</h1>
        {next ? (
          <>
            <p className="mono-data text-2xl font-bold mt-4" style={{ color: 'var(--t1)' }}>
              {formatCountdown(next.kickoffAt, clockNow)}
            </p>
            <p className="text-sm mt-1.5" style={{ color: 'var(--t3)' }}>
              until {next.label} — {next.awayTeam} @ {next.homeTeam}
            </p>
          </>
        ) : (
          <p className="text-sm mt-2" style={{ color: 'var(--t3)' }}>
            No rostered player is in a live game right now. Check back once kickoff is close.
          </p>
        )}
      </div>
    )
  }

  // Group live roster by shared game for a tighter mobile list — repeating
  // the same game-context line per card once cards start stacking is the
  // exact "gets busy" problem flagged during design review.
  const gameGroups = new Map<string, { game: LiveGameContext; players: LiveRosterPlayer[] }>()
  for (const p of status.liveRoster) {
    const key = `${p.game.homeTeam}-${p.game.awayTeam}`
    const group = gameGroups.get(key) ?? { game: p.game, players: [] }
    group.players.push(p)
    gameGroups.set(key, group)
  }

  return (
    <div
      className={`max-w-4xl mx-auto px-4 pt-6 pb-16 md:px-6 md:pt-8 relative ${justUnlocked ? 'live-reveal' : ''}`}
      style={{ filter: idle ? 'brightness(0.4)' : 'none', transition: 'filter 1.2s' }}
      onClick={idle ? wake : undefined}
    >
      {idle && (
        <p className="mono-data text-[9px] tracking-widest uppercase text-center mb-3" style={{ color: 'var(--t4)' }}>
          Dimmed · tap to wake · still tracking
        </p>
      )}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full breathe" style={{ backgroundColor: 'var(--crit)' }} />
          <h1 className="mono-data text-[13px] font-bold tracking-widest" style={{ color: 'var(--crit)' }}>LIVE</h1>
        </div>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            toggleKeepAwake()
          }}
          className="mono-data text-[9.5px] font-semibold tracking-wide px-2.5 py-1 rounded-full"
          style={
            keepAwake
              ? { color: 'var(--signal)', border: '1px solid var(--signal)', backgroundColor: 'var(--signal-dim)' }
              : { color: 'var(--t3)', border: '1px solid var(--hairline)' }
          }
        >
          {keepAwake ? 'SCREEN STAYS ON' : 'KEEP SCREEN ON'}
        </button>
      </div>

      {status.windowRecap && (
        <div className="rounded-xl p-4 mb-6" style={{ backgroundColor: 'rgba(75,163,245,0.06)', border: '1px solid var(--hairline-bright)' }}>
          <div className="flex items-center justify-between">
            <span className="mono-data text-[9px] font-bold tracking-widest" style={{ color: 'var(--signal)' }}>CLAUDE RECAP</span>
          </div>
          <p className="text-sm mt-2" style={{ color: 'var(--t2)' }}>{status.windowRecap.reasoning}</p>
        </div>
      )}

      <p className="mono-data text-[10px] tracking-widest uppercase mb-2" style={{ color: 'var(--t3)' }}>Live now</p>
      {gameGroups.size === 0 ? (
        <div className="rounded-xl p-4 mb-6 text-center" style={{ border: '1px solid var(--hairline)', backgroundColor: 'rgba(8,15,26,0.4)' }}>
          <p className="text-sm" style={{ color: 'var(--t3)' }}>
            No one&rsquo;s live right now — you&rsquo;re between windows today.
            {status.nextKickoff && (
              <> Next kickoff in {formatCountdown(status.nextKickoff.kickoffAt, clockNow)} ({status.nextKickoff.label}).</>
            )}
          </p>
        </div>
      ) : (
      <div className="grid gap-3 md:grid-cols-2 mb-6">
        {[...gameGroups.values()].map(({ game, players }) => (
          <div key={`${game.homeTeam}-${game.awayTeam}`} className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--hairline)' }}>
            <p className="mono-data text-[10px] px-3 py-1.5" style={{ color: 'var(--t3)', backgroundColor: 'rgba(6,11,19,0.5)' }}>
              {game.awayTeam} {game.awayScore} – {game.homeTeam} {game.homeScore} · Q{game.period} {game.displayClock}
            </p>
            {players.map((p) => {
              const recentEvent = status.recentEvents.find((e) => e.player_id === p.playerId)
              const ringColor = recentEvent?.event_type === 'negative' ? 'var(--warn)' : recentEvent ? 'var(--live)' : 'transparent'
              const eventLabel = recentEvent
                ? recentEvent.event_type === 'touchdown'
                  ? 'TD'
                  : recentEvent.event_type === 'reception'
                    ? 'REC'
                    : recentEvent.event_type === 'negative'
                      ? 'INT/FUM'
                      : 'YDS'
                : null
              return (
                <button
                  type="button"
                  key={p.playerId}
                  onClick={() => openStatSheet(p)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 text-left"
                  style={{ borderTop: '1px solid var(--hairline)', backgroundColor: 'rgba(8,15,26,0.6)' }}
                >
                  <img
                    src={playerPhotoUrl(p.playerId)}
                    alt={p.name}
                    className="w-10 h-10 rounded-full object-cover flex-shrink-0"
                    style={{ backgroundColor: 'var(--glass-solid)', border: `2px solid ${ringColor}`, transition: 'border-color 1s' }}
                    onError={(e) => { e.currentTarget.style.visibility = 'hidden' }}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-white truncate">{p.name}</p>
                    <p className="text-xs" style={{ color: 'var(--t3)' }}>{p.position} · {p.nflTeam}</p>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {p.leagues.map((l) => (
                        <span
                          key={l.leagueId}
                          className="mono-data text-[8.5px] font-semibold px-1.5 py-0.5 rounded-full"
                          style={
                            l.status === 'starting'
                              ? { color: 'var(--signal)', border: '1px solid rgba(75,163,245,.4)', backgroundColor: 'var(--signal-dim)' }
                              : { color: 'var(--t3)', border: '1px solid var(--hairline)' }
                          }
                        >
                          {l.leagueName}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="mono-data text-lg font-bold" style={{ color: 'var(--t1)' }}>{p.points.toFixed(1)}</p>
                    {recentEvent && eventLabel && (
                      <p
                        className="mono-data text-[9.5px] font-semibold tracking-wide mt-0.5"
                        style={{ color: recentEvent.event_type === 'negative' ? 'var(--warn)' : 'var(--live)' }}
                      >
                        {recentEvent.delta > 0 ? '+' : ''}{recentEvent.delta.toFixed(1)} {eventLabel}
                      </p>
                    )}
                  </div>
                </button>
              )
            })}
          </div>
        ))}
      </div>
      )}

      {status.updates.length > 0 && (
        <>
          <p className="mono-data text-[10px] tracking-widest uppercase mb-2" style={{ color: 'var(--t3)' }}>
            Player updates <span style={{ color: 'var(--signal)' }}>{status.updates.length}</span>
          </p>
          <div className="space-y-1.5 mb-6">
            {status.updates.map((u) => (
              <Link
                key={u.pulseItemId}
                href="/pulse"
                className="flex items-center gap-2.5 rounded-lg px-3 py-2"
                style={{ border: '1px solid var(--hairline)', backgroundColor: 'rgba(8,15,26,0.6)' }}
              >
                <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: 'var(--signal)' }} />
                <span className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-white truncate">{u.headline}</p>
                  <p className="text-[11px] truncate" style={{ color: 'var(--t3)' }}>{u.reasoning}</p>
                </span>
                <span style={{ color: 'var(--t4)' }}>›</span>
              </Link>
            ))}
          </div>
        </>
      )}

      {status.matchups.length > 0 && (
        <>
          <p className="mono-data text-[10px] tracking-widest uppercase mb-2" style={{ color: 'var(--t3)' }}>Your matchups</p>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {status.matchups.map((m) => (
              <div key={m.leagueId} className="rounded-lg px-3 py-2 flex-shrink-0" style={{ border: '1px solid var(--hairline)', minWidth: 150 }}>
                <p className="mono-data text-[9px] uppercase" style={{ color: 'var(--t3)' }}>{m.leagueName}</p>
                <div className="flex items-baseline justify-between mt-1">
                  <span className="mono-data text-sm font-bold" style={{ color: 'var(--live)' }}>{m.myScore.toFixed(1)}</span>
                  <span className="mono-data text-[9px]" style={{ color: 'var(--t4)' }}>vs</span>
                  <span className="mono-data text-sm" style={{ color: 'var(--t3)' }}>{m.opponentScore.toFixed(1)}</span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {bigPlay && (
        <div
          className="fixed inset-0 z-50 flex flex-col items-center justify-center panel-enter"
          style={{ background: 'radial-gradient(circle at 50% 40%, rgba(67,192,119,.16), rgba(5,9,16,.94) 68%)' }}
          onClick={() => setBigPlay(null)}
        >
          <img
            src={playerPhotoUrl(bigPlay.player.playerId)}
            alt={bigPlay.player.name}
            className="w-32 h-32 rounded-full object-cover"
            style={{ border: '2px solid var(--live)', boxShadow: '0 0 60px rgba(67,192,119,.5)' }}
          />
          <p className="mono-data text-xs font-bold tracking-widest mt-4" style={{ color: 'var(--live)' }}>TOUCHDOWN</p>
          <p className="text-xl font-bold text-white mt-1.5">{bigPlay.player.name}</p>
          <p className="mono-data text-2xl font-extrabold mt-2.5" style={{ color: 'var(--live)' }}>
            +{bigPlay.event.delta.toFixed(1)} PTS
          </p>
        </div>
      )}

      {statSheet && (
        <div
          className="fixed inset-0 z-50 flex items-end md:items-center justify-center panel-enter"
          style={{ backgroundColor: 'rgba(5,9,16,.72)' }}
          onClick={() => setStatSheet(null)}
        >
          <div
            className="w-full md:max-w-sm rounded-t-2xl md:rounded-2xl p-5"
            style={{ backgroundColor: 'var(--bg2, #0a121f)', border: '1px solid var(--hairline-bright)', maxHeight: '80vh', overflowY: 'auto' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3">
              <img
                src={playerPhotoUrl(statSheet.player.playerId)}
                alt={statSheet.player.name}
                className="w-12 h-12 rounded-full object-cover flex-shrink-0"
                style={{ backgroundColor: 'var(--glass-solid)' }}
                onError={(e) => { e.currentTarget.style.visibility = 'hidden' }}
              />
              <div className="min-w-0 flex-1">
                <p className="text-base font-semibold text-white truncate">{statSheet.player.name}</p>
                <p className="text-xs" style={{ color: 'var(--t3)' }}>{statSheet.player.position} · {statSheet.player.nflTeam}</p>
              </div>
              <button type="button" onClick={() => setStatSheet(null)} aria-label="Close" style={{ color: 'var(--t3)' }} className="text-lg px-1">✕</button>
            </div>

            <p className="mono-data text-[9px] tracking-widest uppercase mt-5 mb-2" style={{ color: 'var(--t3)' }}>Live box score · Sleeper</p>

            {statSheet.loading ? (
              <div className="h-16 rounded-lg animate-pulse" style={{ backgroundColor: 'rgba(8,15,26,0.6)' }} />
            ) : statSheet.lines.length === 0 ? (
              <p className="text-sm" style={{ color: 'var(--t3)' }}>
                No recorded stats yet for this player this week — check back once the game is underway.
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {statSheet.lines.map((s) => (
                  <div key={s.label} className="rounded-lg px-3 py-2" style={{ border: '1px solid var(--hairline)' }}>
                    <p className="mono-data text-[9px] tracking-wide" style={{ color: 'var(--t3)' }}>{s.label}</p>
                    <p className="mono-data text-lg font-bold" style={{ color: 'var(--t1)' }}>{s.value}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
