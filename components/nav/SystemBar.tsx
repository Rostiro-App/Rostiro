'use client'

// T-67 → OS redesign: the system bar is now glass over the ambient ground,
// set entirely in mono — it reads as instrument chrome, not a header. Live
// behavior unchanged: polls /api/system/status once a minute, the 1-second
// ticker renders "SYNCED XS AGO" and the countdown from data it already
// has, and a failed poll degrades to last-known state rather than blanking.
// The sync dot pings on a loop: visible evidence the OS is monitoring.

import { useEffect, useRef, useState } from 'react'
import { type Mode, ModeButton, ModeSwitcher } from './AppShell'
import PulseMark from '@/components/PulseMark'
import { useGameDayKickoffTransition } from '@/lib/gameDayTransition'
import HintAnchor from '@/components/hints/HintAnchor'
import type { LeagueHealthStatus, LiveGameScore, SystemStatus, UserPlan } from '@/types'

// T-110: nothing in the UI showed plan at all — free deliberately gets no
// badge (nothing to flaunt, and it avoids a naggy "FREE" label); paid tiers
// get a real, visible marker. Gold matches PLAYOFFS_OVERLAY's championship
// accent already established in brandTokens.ts — a deliberate reuse, not a
// new color introduced just for this.
const PLAN_LABEL: Record<UserPlan, string | null> = {
  free: null,
  starter: 'STARTER',
  pro: 'PRO',
  commissioner: 'FOUNDER',
}

const POLL_INTERVAL_MS = 60_000

const DOT_COLOR: Record<LeagueHealthStatus, string> = {
  healthy: 'var(--live)',
  monitor: 'var(--warn)',
  action: 'var(--crit)',
  unknown: 'transparent',
}
const DOT_GLOW: Record<LeagueHealthStatus, string> = {
  healthy: '0 0 7px rgba(67,192,119,.7)',
  monitor: '0 0 7px rgba(245,166,35,.7)',
  action: '0 0 7px rgba(232,80,74,.7)',
  unknown: 'none',
}

export default function SystemBar({
  mode,
  onModeChange,
}: {
  mode: Mode
  onModeChange: (m: Mode) => void
}) {
  const [status, setStatus] = useState<SystemStatus | null>(null)
  const [syncing, setSyncing] = useState(true)
  const [lastSyncAt, setLastSyncAt] = useState<number | null>(null)
  const [now, setNow] = useState(() => Date.now())
  const [switcherOpen, setSwitcherOpen] = useState(false)
  const failCount = useRef(0)

  useEffect(() => {
    let cancelled = false

    async function poll() {
      setSyncing(true)
      try {
        const res = await fetch('/api/system/status')
        if (!res.ok) throw new Error('status failed')
        const data: SystemStatus = await res.json()
        if (cancelled) return
        setStatus(data)
        setLastSyncAt(Date.now())
        failCount.current = 0
      } catch {
        // The bar degrades to whatever it last knew — a failed poll never
        // blanks ambient state, it just gets stale (and says so).
        failCount.current++
      } finally {
        if (!cancelled) setSyncing(false)
      }
    }

    poll()
    const interval = setInterval(poll, POLL_INTERVAL_MS)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [])

  // 1-second ticker for the sync label and countdown.
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1_000)
    return () => clearInterval(t)
  }, [])

  const syncLabel = syncing && lastSyncAt === null
    ? 'SYNCING…'
    : lastSyncAt !== null
      ? formatSyncAge(now - lastSyncAt)
      : 'OFFLINE'

  const deadline = status?.nextDeadline ?? null
  const deadlineMs = deadline ? new Date(deadline.at).getTime() - now : null

  // T-92/T-97: plays once, the first moment this client notices a game
  // actually go live — never on every 60s poll while already in it, and
  // not during the pregame ramp computeState now enters up to 3h before
  // kickoff (rostiroState alone no longer means "live").
  const hasLiveGames = (status?.liveScores ?? []).some((g) => g.statusState !== 'pre')
  const kickoffSweeping = useGameDayKickoffTransition(status?.rostiroState ?? null, hasLiveGames)

  return (
    <>
      <div
        className={`glass-bar mono-data flex items-center gap-3 md:gap-5 px-3 md:px-4 flex-shrink-0 relative z-20 ${kickoffSweeping ? 'kickoff-sweep' : ''}`}
        style={{ borderBottom: '1px solid var(--hairline)', height: '42px', fontSize: '11px' }}
      >
        {/* Pulse mark — the one element that visibly reflects the active
            Rostiro State (PRD 6.10 / brand kit §2-5). Defaults to Standard's
            resting color until the first status poll resolves. */}
        <span className="flex md:hidden items-center gap-1 flex-shrink-0">
          <span className="font-medium text-[13px]" style={{ color: 'var(--t1)' }}>R</span>
          <PulseMark state={status?.rostiroState ?? 'standard'} />
        </span>

        {/* Wordmark — desktop only (mobile keeps every pixel for state) */}
        <span className="hidden md:flex items-center gap-2.5 flex-shrink-0">
          <PulseMark state={status?.rostiroState ?? 'standard'} />
          <span aria-hidden="true" style={{ width: 1, height: 14, backgroundColor: 'var(--hairline)' }} />
          <span className="flex items-baseline gap-1.5">
            <span className="font-bold tracking-[0.18em] text-[11.5px]" style={{ color: 'var(--t1)' }}>
              ROSTIRO
            </span>
            <span
              className="text-[8.5px] font-bold tracking-[0.14em] px-1 rounded"
              style={{
                color: 'var(--signal)',
                border: '1px solid rgba(75,163,245,0.45)',
                textShadow: '0 0 12px rgba(75,163,245,0.65)',
              }}
            >
              OS
            </span>
          </span>
        </span>

        {/* Sync state — the ping is the heartbeat */}
        <span className="flex items-center gap-2 flex-shrink-0" style={{ color: 'var(--t2)' }}>
          <span
            className="ping-dot w-1.5 h-1.5 rounded-full"
            style={{
              color: syncing ? 'var(--signal)' : 'var(--live)',
              backgroundColor: syncing ? 'var(--signal)' : 'var(--live)',
              boxShadow: syncing ? '0 0 8px rgba(75,163,245,.8)' : '0 0 8px rgba(67,192,119,.8)',
            }}
          />
          {/* Re-keyed on each successful poll so the label ticks exactly
              when the data is actually fresh, not every second. */}
          <span key={lastSyncAt ?? 0} className="hidden sm:inline value-tick">{syncLabel}</span>
        </span>

        {/* League health dots */}
        {status && status.leagues.length > 0 && (
          <HintAnchor id="system-bar-health">
          <span className="flex items-center gap-2.5">
            <span className="hidden md:inline text-[9px] tracking-[0.14em]" style={{ color: 'var(--t3)' }}>
              LEAGUES
            </span>
            {status.leagues.map((l, i) => (
              <span key={l.id} className="relative group">
                <span
                  className={l.health.status === 'healthy' || l.health.status === 'monitor' ? 'breathe block w-2 h-2 rounded-full cursor-default' : 'block w-2 h-2 rounded-full cursor-default'}
                  style={{
                    backgroundColor: DOT_COLOR[l.health.status],
                    boxShadow: DOT_GLOW[l.health.status],
                    border: l.health.status === 'unknown' ? '1px solid var(--t3)' : 'none',
                    animationDelay: `${i * 1.4}s`,
                  }}
                />
                <span
                  className="glass-heavy hidden group-hover:block absolute top-4 left-1/2 -translate-x-1/2 whitespace-nowrap text-[10.5px] px-2.5 py-1.5 rounded-lg z-50"
                  style={{ color: 'var(--t1)' }}
                >
                  {l.name} ·{' '}
                  <b style={{ color: 'var(--signal)', fontWeight: 600 }}>
                    {l.health.score !== null ? l.health.score : '—'}
                  </b>
                </span>
              </span>
            ))}
          </span>
          </HintAnchor>
        )}

        {/* T-90: live scores — Game Day only, and only for games where a
            rostered player is on either team (6.1 cross-league relevance).
            Games that haven't kicked off yet stay silent here rather than
            showing a fake "0-0" — that's the pregame ramp's (T-97) job, not
            this badge's. */}
        {status?.rostiroState === 'game_day' && (
          <LiveScoreBadge games={status.liveScores} gated={status.scoresGated} />
        )}

        <span className="flex-1" />

        {/* Deadline countdown — T-93/6.12: a lineup-lock deadline ramps
            calm -> warm -> urgent as it nears (extending T-67's existing
            countdown pattern); draft/waiver deadlines keep the flat amber
            they've always had. */}
        {deadline && deadlineMs !== null && deadlineMs > 0 && (
          <span className="flex items-baseline gap-2 flex-shrink-0">
            <span
              className="text-[9px] tracking-[0.14em] uppercase truncate max-w-28 md:max-w-none"
              style={{ color: deadline.kind === 'lineup_lock' ? lineupLockRampColor(deadlineMs) : 'var(--warn)' }}
            >
              {deadline.label} · {deadline.leagueName}
            </span>
            <span
              className={`text-xs ${deadline.kind === 'lineup_lock' && deadlineMs < 5 * 60_000 ? 'breathe' : ''}`}
              style={{
                color: 'var(--t1)',
                textShadow: `0 0 14px ${deadline.kind === 'lineup_lock' ? lineupLockRampGlow(deadlineMs) : 'rgba(245,166,35,0.25)'}`,
              }}
            >
              {formatCountdown(deadlineMs)}
            </span>
          </span>
        )}

        {/* Plan badge — visible on both breakpoints, unlike the wordmark's
            "OS" chip which is desktop-only. Founder gets a visibly distinct
            treatment (filled, star-marked), not just Pro's label swapped —
            Section 9 promises Founders a real "founder badge," not a
            re-skinned Pro chip. Full founder recognition (priority feedback
            access, early feature previews) is real scope beyond this and is
            logged separately, not attempted here. */}
        {status && PLAN_LABEL[status.plan] && (
          <span
            className="text-[8.5px] font-bold tracking-[0.14em] px-1.5 py-0.5 rounded flex-shrink-0"
            style={
              status.plan === 'commissioner'
                ? {
                    color: '#0D0800',
                    backgroundColor: '#F5C842',
                    boxShadow: '0 0 12px rgba(245,200,66,0.7)',
                  }
                : {
                    color: '#F5C842',
                    border: '1px solid rgba(245,200,66,0.5)',
                    textShadow: '0 0 10px rgba(245,200,66,0.5)',
                  }
            }
          >
            {status.plan === 'commissioner' ? `★ ${PLAN_LABEL[status.plan]}` : PLAN_LABEL[status.plan]}
          </span>
        )}

        {/* Mode chip */}
        <HintAnchor id="mode-chip">
          <ModeButton mode={mode} onClick={() => setSwitcherOpen(true)} />
        </HintAnchor>

        {/* ⌘K affordance */}
        <HintAnchor id="command-palette" desktopOnly className="relative hidden md:inline-flex">
        <button
          type="button"
          onClick={() => window.dispatchEvent(new CustomEvent('rostiro:open-command-palette'))}
          className="hidden md:flex items-center gap-1.5 text-[10.5px] px-2.5 py-1 rounded-lg transition-all hover:shadow-[0_0_14px_rgba(75,163,245,0.18)]"
          style={{ color: 'var(--t2)', border: '1px solid var(--hairline)' }}
        >
          Command
          <kbd
            className="text-[9.5px] px-1 rounded"
            style={{
              border: '1px solid var(--hairline)',
              borderBottomWidth: '2px',
              color: 'var(--t3)',
            }}
          >
            ⌘K
          </kbd>
        </button>
        </HintAnchor>
      </div>

      {switcherOpen && (
        <ModeSwitcher
          current={mode}
          onSelect={(m) => {
            onModeChange(m)
            setSwitcherOpen(false)
          }}
          onClose={() => setSwitcherOpen(false)}
        />
      )}
    </>
  )
}

function LiveScoreBadge({ games, gated }: { games: LiveGameScore[]; gated: boolean }) {
  const live = games.filter((g) => g.rosterRelevant && g.statusState !== 'pre')
  if (live.length === 0) return null

  return (
    <span className="hidden sm:flex items-center gap-1.5 flex-shrink-0 relative group">
      <span
        className="breathe w-[5px] h-[5px] rounded-full flex-shrink-0"
        style={{ backgroundColor: 'var(--live)', boxShadow: '0 0 6px var(--live)' }}
      />
      {live.length === 1 ? (
        <span className="value-tick flex items-baseline gap-1.5 min-w-0">
          <span style={{ color: 'var(--t1)', filter: gated ? 'blur(4px)' : 'none', userSelect: gated ? 'none' : 'auto' }}>
            {gameLabel(live[0])}
          </span>
          {/* UX Behavior Spec Gap #1: never blurred — this is "why this
              game is yours," not the score itself, so it isn't Pro-gated. */}
          {playerSummary(live[0].relevantPlayers) && (
            <span className="hidden md:inline truncate max-w-40" style={{ color: 'var(--t3)' }}>
              · {playerSummary(live[0].relevantPlayers)}
            </span>
          )}
        </span>
      ) : (
        <span className="value-tick" style={{ color: 'var(--t1)' }}>{live.length} LIVE</span>
      )}
      {gated && (
        <span
          className="text-[8.5px] font-bold tracking-[0.12em] px-1 rounded flex-shrink-0"
          style={{ color: 'var(--signal)', border: '1px solid rgba(75,163,245,0.45)' }}
        >
          PRO
        </span>
      )}
      {live.length > 1 && (
        <span
          className="glass-heavy hidden group-hover:flex flex-col gap-1 absolute top-5 left-0 whitespace-nowrap text-[10.5px] px-2.5 py-1.5 rounded-lg z-50"
          style={{ color: 'var(--t1)' }}
        >
          {live.map((g) => (
            <span key={g.gameId} className="flex items-baseline gap-1.5">
              <span style={{ filter: gated ? 'blur(4px)' : 'none' }}>{gameLabel(g)}</span>
              {playerSummary(g.relevantPlayers) && (
                <span style={{ color: 'var(--t3)' }}>· {playerSummary(g.relevantPlayers)}</span>
              )}
            </span>
          ))}
        </span>
      )}
    </span>
  )
}

function gameLabel(g: LiveGameScore): string {
  const clock = g.statusState === 'post' ? 'FINAL' : `Q${g.period} ${g.displayClock}`
  return `${g.awayTeam} ${g.awayScore} – ${g.homeTeam} ${g.homeScore} · ${clock}`
}

// UX Behavior Spec Gap #1: "Hurts, Barkley (2 leagues)" — names every
// rostered player that made this game relevant, and how many distinct
// leagues they span. Empty string (never rendered) when there's nothing
// to attribute, e.g. the DEMO_MODE team-only override with no players.
function playerSummary(players: LiveGameScore['relevantPlayers']): string {
  if (!players || players.length === 0) return ''
  const names = players.map((p) => p.name).join(', ')
  const leagueCount = new Set(players.flatMap((p) => p.leagueNames)).size
  return leagueCount > 0 ? `${names} (${leagueCount} ${leagueCount === 1 ? 'league' : 'leagues'})` : names
}

// T-93/6.12: calm -> warm -> urgent as a lineup-lock deadline nears. Plain
// hex/rgba, not var() references — these feed a template string alongside
// an opacity/blur suffix, which CSS custom properties can't do.
function lineupLockRampColor(ms: number): string {
  if (ms < 5 * 60_000) return '#E8504A' // urgent — matches --crit
  if (ms < 15 * 60_000) return '#F5A623' // warm — matches --warn
  return '#4BA3F5' // calm — matches --signal
}
function lineupLockRampGlow(ms: number): string {
  if (ms < 5 * 60_000) return 'rgba(232,80,74,0.35)'
  if (ms < 15 * 60_000) return 'rgba(245,166,35,0.25)'
  return 'rgba(75,163,245,0.2)'
}

function formatSyncAge(ms: number): string {
  const sec = Math.max(0, Math.floor(ms / 1000))
  if (sec < 60) return `SYNCED ${sec}S AGO`
  const min = Math.floor(sec / 60)
  if (min < 60) return `SYNCED ${min}M AGO`
  return `SYNCED ${Math.floor(min / 60)}H AGO`
}

function formatCountdown(ms: number): string {
  const totalSec = Math.floor(ms / 1000)
  const days = Math.floor(totalSec / 86_400)
  const h = Math.floor((totalSec % 86_400) / 3_600)
  const m = Math.floor((totalSec % 3_600) / 60)
  const s = totalSec % 60
  const pad = (n: number) => String(n).padStart(2, '0')
  if (days > 0) return `${days}D ${pad(h)}:${pad(m)}:${pad(s)}`
  return `${pad(h)}:${pad(m)}:${pad(s)}`
}
