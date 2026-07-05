'use client'

// T-69 + OS redesign: the Pulse queue on glass. Cards carry a glowing
// priority stripe, all metadata is mono, and clicking a card opens the
// right-hand detail drawer (glass over a blurred veil) instead of
// navigating away. Done/Snooze animate the card out of the queue and the
// progress bar advances — the day is a finite work queue, not a feed.
// Live behavior unchanged from T-69: persistent items, optimistic PATCH
// with rollback, persistent: false hides actions until the migration runs.

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useMode, type Mode } from '@/components/nav/AppShell'
import { STATE_CONFIG } from '@/lib/brandTokens'
import { useGameDayKickoffTransition } from '@/lib/gameDayTransition'
import { useFocusTrap } from '@/lib/useFocusTrap'
import type { LiveGameScore, PulseItem, PulseItemType, PulsePriority, RostiroState } from '@/types'

// ─── Priority + type config ────────────────────────────────────────────────────

const PRIORITY_COLOR: Record<PulsePriority, string> = {
  critical: 'var(--crit)',
  important: 'var(--warn)',
  info: 'var(--signal)',
}
const PRIORITY_GLOW: Record<PulsePriority, string> = {
  critical: '0 0 10px rgba(232,80,74,.8)',
  important: '0 0 10px rgba(245,166,35,.7)',
  info: '0 0 10px rgba(75,163,245,.6)',
}

const TYPE_CONFIG: Record<PulseItemType, { color: string; label: string }> = {
  injury_alert:      { color: 'var(--crit)',   label: 'INJURY' },
  lineup_decision:   { color: 'var(--signal)', label: 'START/SIT' },
  waiver_alert:      { color: 'var(--live)',   label: 'WAIVER' },
  weather_alert:     { color: 'var(--warn)',   label: 'WEATHER' },
  trade_opportunity: { color: 'var(--signal)', label: 'TRADE' },
  opponent_intel:    { color: 'var(--t2)',     label: 'INTEL' },
  deadline_reminder: { color: 'var(--warn)',   label: 'DEADLINE' },
  exposure_flag:     { color: 'var(--crit)',   label: 'EXPOSURE' },
  // T-93: excitement/ownership pride (6.12) — same green as a waiver win.
  touchdown_swing:   { color: 'var(--live)',   label: 'TOUCHDOWN' },
  // Urgency without punishment (6.12) — amber, same as the deadline chip.
  lineup_lock:       { color: 'var(--warn)',   label: 'LINEUP LOCK' },
  // Relief, not celebration or alarm — calm signal blue, deliberately quiet.
  mission_complete:  { color: 'var(--signal)', label: 'MISSION COMPLETE' },
  // Pride/ownership (PRD line 737's "post-draft" emotional beat) — same
  // green as a waiver win, a positive moment without being loud about it.
  roster_grade:      { color: 'var(--live)',   label: 'ROSTER GRADE' },
  // Quiet informational tone — a neutral gray, distinct from the alert
  // colors above since this is "here's news," not "something needs a call."
  player_news:       { color: 'var(--t2)',     label: 'NEWS' },
  // T-99: the positive mirror to injury_alert — same green family as a
  // waiver win/roster grade, since it's an opportunity, not a warning.
  opportunity_surge: { color: 'var(--live)',   label: 'OPPORTUNITY' },
}

type PulseAction = 'done' | 'dismiss' | 'snooze'

interface PulseResponse {
  items: PulseItem[]
  leagueCount: number
  doneToday: number
  estMinutes: number
  firstName: string | null
  persistent: boolean
}

// T-108
interface FilmRoomUsageSignal {
  name: string
  position: string | null
  direction: 'buy_low' | 'sell_high'
  deltaPct: number
}

interface FilmRoomLeagueResult {
  leagueId: string
  leagueName: string
  myScore: number
  opponentScore: number
  won: boolean | null
  usageSignal: FilmRoomUsageSignal | null
  recap: string | null
}

// ─── Pulse page ────────────────────────────────────────────────────────────────

export default function PulsePage() {
  const mode = useMode()
  const [items, setItems] = useState<PulseItem[]>([])
  const [leaving, setLeaving] = useState<Set<string>>(new Set())
  const [leagueCount, setLeagueCount] = useState(0)
  const [doneToday, setDoneToday] = useState(0)
  const [estMinutes, setEstMinutes] = useState(0)
  const [firstName, setFirstName] = useState<string | null>(null)
  const [persistent, setPersistent] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [detail, setDetail] = useState<PulseItem | null>(null)
  const [rostiroState, setRostiroState] = useState<RostiroState>('standard')
  const [liveScores, setLiveScores] = useState<LiveGameScore[]>([])
  const [scoresGated, setScoresGated] = useState(false)
  // T-109: leagueCount above is Sleeper-only (buildPulseItemsForUser's own
  // filter) — this is every connected league, any platform, so the empty
  // state can tell "truly no leagues" apart from "has leagues, none of
  // them Sleeper," which otherwise look identical and aren't.
  const [totalLeagueCount, setTotalLeagueCount] = useState(0)
  const [filmRoomResults, setFilmRoomResults] = useState<FilmRoomLeagueResult[]>([])

  // T-94/T-90: Waiver Day Mission Briefing framing + Game Day live scores
  // (PRD 6.10/6.13). One-shot fetch — this page doesn't need the 60s
  // freshness SystemBar polls /api/system/status for, just the state at
  // load. Duplicates that poll for now; folding both into one shared
  // context is the natural follow-up once a second consumer like this
  // exists.
  useEffect(() => {
    let cancelled = false
    fetch('/api/system/status')
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { rostiroState?: RostiroState; liveScores?: LiveGameScore[]; scoresGated?: boolean; leagues?: unknown[] } | null) => {
        if (cancelled || !data) return
        if (data.rostiroState) setRostiroState(data.rostiroState)
        setLiveScores(data.liveScores ?? [])
        setScoresGated(data.scoresGated ?? false)
        setTotalLeagueCount(data.leagues?.length ?? 0)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  // T-108/T-95: only fetched during Film Room — real Sleeper matchup data
  // for the most recently completed week, plus a Claude-narrated recap and
  // a buy-low/sell-high usage signal (T-87's nflverse pipeline). Both are
  // additive — a preseason week with no snap data, or a Claude failure,
  // still shows the score.
  useEffect(() => {
    if (rostiroState !== 'film_room') return
    let cancelled = false
    fetch(`/api/film-room?mode=${mode}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { results?: FilmRoomLeagueResult[] } | null) => {
        if (!cancelled && data) setFilmRoomResults(data.results ?? [])
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [rostiroState, mode])

  useEffect(() => {
    let cancelled = false

    fetch('/api/pulse/sleeper')
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load Pulse')
        return res.json()
      })
      .then((data: PulseResponse) => {
        if (cancelled) return
        setItems(data.items)
        setLeagueCount(data.leagueCount)
        setDoneToday(data.doneToday)
        setEstMinutes(data.estMinutes)
        setFirstName(data.firstName)
        setPersistent(data.persistent)
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [])

  // Escape dismisses the drawer.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setDetail(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  async function handleAction(item: PulseItem, action: PulseAction) {
    setDetail(null)
    // Animate out, then drop from state; on failure the card comes back.
    setLeaving((prev) => new Set(prev).add(item.id))
    if (action === 'done') setDoneToday((n) => n + 1)

    window.setTimeout(() => {
      setItems((prev) => prev.filter((i) => i.id !== item.id))
      setLeaving((prev) => {
        const next = new Set(prev)
        next.delete(item.id)
        return next
      })
    }, 340)

    try {
      const res = await fetch(`/api/pulse/items/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      if (!res.ok) throw new Error()
    } catch {
      setItems((prev) => (prev.some((i) => i.id === item.id) ? prev : [item, ...prev]))
      if (action === 'done') setDoneToday((n) => Math.max(0, n - 1))
      setError('Could not update that item — try again.')
      setTimeout(() => setError(null), 4000)
    }
  }

  const totalToday = items.length + doneToday

  // T-90: games actually in progress or finished, involving a rostered
  // player — a not-yet-kicked-off game stays silent here (never a fake
  // "0-0"); that's the pregame ramp's (T-97) territory, not this card's.
  const liveGames = rostiroState === 'game_day'
    ? liveScores.filter((g) => g.rosterRelevant && g.statusState !== 'pre')
    : []
  // T-97: computeState returns 'game_day' up to 3h before the earliest
  // kickoff now — Mission Control (and the kickoff sweep below) only kick
  // in once a game has actually started, not for the whole ramp window.
  // Inside the ramp itself, it's the last realistic chance to fix a
  // lineup before it locks — that's what the reorder below surfaces.
  const isMissionControl = rostiroState === 'game_day' && liveGames.length > 0
  const isPregameRamp = rostiroState === 'game_day' && liveGames.length === 0

  // Waiver Day / pregame ramp: priority items lead the queue, ahead of
  // same-priority-tier items — a stable reorder, not a re-sort, so nothing
  // else in the ordering shifts.
  const displayItems = rostiroState === 'waiver_day'
    ? [...items].sort((a, b) => Number(b.type === 'waiver_alert') - Number(a.type === 'waiver_alert'))
    : isPregameRamp
      ? [...items].sort((a, b) => Number(b.type === 'lineup_decision') - Number(a.type === 'lineup_decision'))
      : items
  const waiverCount = items.filter((i) => i.type === 'waiver_alert').length
  const isMissionBriefing = rostiroState === 'waiver_day' && waiverCount > 0
  const pregameLineupCount = items.filter((i) => i.type === 'lineup_decision').length
  const isPregameCheck = isPregameRamp && pregameLineupCount > 0
  // T-92: plays once, the first moment this client notices a game go live.
  const kickoffSweeping = useGameDayKickoffTransition(rostiroState, liveGames.length > 0)

  return (
    <div className="max-w-2xl mx-auto px-4 pt-6 pb-8 md:px-6 md:pt-8">

      {/* Morning header — the day framed as a finite work queue.
          Waiver Day State (6.10/6.13): reframes to "Mission Briefing" —
          opportunity-green tag, waiver-target count leads the subtext —
          only when there's actually a waiver item to brief on. */}
      <div className="mb-6">
        {isMissionBriefing && (
          <span
            className="mono-data inline-block text-[9.5px] tracking-[0.16em] px-2 py-0.5 rounded-full mb-2"
            style={{
              color: STATE_CONFIG.waiver_day.color,
              border: `1px solid ${STATE_CONFIG.waiver_day.color}`,
              backgroundColor: 'color-mix(in srgb, currentColor 12%, transparent)',
            }}
          >
            MISSION BRIEFING
          </span>
        )}
        {/* T-92/6.13: Pulse's header relabel to "Mission Control" for Game
            Day — persistent while the state holds, but the kickoff sweep
            (once per day, the actual transition moment) flickers it in via
            the same mono-value grammar as the System Bar's sync label
            rather than popping in instantly. */}
        {isMissionControl && (
          <span
            key={kickoffSweeping ? 'mission-control-sweep' : 'mission-control-steady'}
            className={`mono-data inline-block text-[9.5px] tracking-[0.16em] px-2 py-0.5 rounded-full mb-2 ${kickoffSweeping ? 'value-tick' : ''}`}
            style={{
              color: STATE_CONFIG.game_day.color,
              border: `1px solid ${STATE_CONFIG.game_day.color}`,
              backgroundColor: 'color-mix(in srgb, currentColor 12%, transparent)',
            }}
          >
            MISSION CONTROL
          </span>
        )}
        {/* T-97: the pregame ramp (up to 3h before the day's earliest
            kickoff) is the last realistic window to fix a lineup — framed
            as its own moment, distinct from both Standard's calm queue and
            Mission Control's already-live one. */}
        {isPregameCheck && (
          <span
            className="mono-data inline-block text-[9.5px] tracking-[0.16em] px-2 py-0.5 rounded-full mb-2"
            style={{
              color: STATE_CONFIG.game_day.color,
              border: `1px solid ${STATE_CONFIG.game_day.color}`,
              backgroundColor: 'color-mix(in srgb, currentColor 12%, transparent)',
            }}
          >
            LAST CALL BEFORE KICKOFF
          </span>
        )}
        <h1 className="text-[22px] font-semibold tracking-tight" style={{ color: 'var(--t1)' }}>
          {greeting()}{firstName ? `, ${firstName}` : ''}.
        </h1>
        <p className="text-[13px] mt-0.5" style={{ color: 'var(--t2)' }}>
          {leagueCount === 0
            ? 'No leagues connected yet'
            : items.length === 0
              ? `All clear across ${leagueCount} ${leagueCount === 1 ? 'league' : 'leagues'}`
              : isMissionBriefing
                ? (
                  <>
                    <b style={{ color: STATE_CONFIG.waiver_day.color, fontWeight: 600 }}>
                      {waiverCount} priority waiver {waiverCount === 1 ? 'target' : 'targets'}
                    </b>
                    {` across ${leagueCount} ${leagueCount === 1 ? 'league' : 'leagues'}`}
                  </>
                )
                : isPregameCheck
                ? (
                  <>
                    <b style={{ color: STATE_CONFIG.game_day.color, fontWeight: 600 }}>
                      {pregameLineupCount} {pregameLineupCount === 1 ? 'lineup' : 'lineups'} to confirm
                    </b>
                    {' before kickoff — don’t sleep on this matchup'}
                  </>
                )
                : (
                  <>
                    <b style={{ color: 'var(--t1)', fontWeight: 600 }}>
                      {items.length} {items.length === 1 ? 'decision' : 'decisions'}
                    </b>
                    {` across ${leagueCount} ${leagueCount === 1 ? 'league' : 'leagues'}`}
                    {estMinutes > 0 && (
                      <> · Est. <b style={{ color: 'var(--t1)', fontWeight: 600 }}>{estMinutes} min</b></>
                    )}
                  </>
                )}
        </p>

        {persistent && totalToday > 0 && (
          <div className="mono-data mt-3.5 flex items-center gap-3 text-[10px] tracking-[0.1em]" style={{ color: 'var(--t3)' }}>
            <span>TODAY</span>
            <div className="flex-1 h-[3px] rounded-full overflow-hidden" style={{ backgroundColor: 'rgba(90,150,210,.12)' }}>
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${Math.round((doneToday / totalToday) * 100)}%`,
                  background: doneToday === totalToday
                    ? 'var(--live)'
                    : 'linear-gradient(90deg, var(--signal), #6FC7FF)',
                  boxShadow: '0 0 10px rgba(75,163,245,.6)',
                }}
              />
            </div>
            <span>{doneToday} / {totalToday}</span>
          </div>
        )}
      </div>

      {/* T-90: Live Now — Game Day's live-score presence in Pulse (PRD 6.10/
          6.13). Roster-relevant only, matching Pulse's existing North Star
          rule; scores blur for free plan per 9's "unblurred live scores" as
          a Pro depth-gate. */}
      {liveGames.length > 0 && (
        <div
          className="glass rounded-xl px-4 py-3 mb-4"
          style={{ borderLeft: `2.5px solid ${STATE_CONFIG.game_day.color}`, boxShadow: `0 0 10px ${STATE_CONFIG.game_day.color}33` }}
        >
          <span
            className="mono-data text-[9.5px] tracking-[0.16em]"
            style={{ color: STATE_CONFIG.game_day.color }}
          >
            LIVE NOW
          </span>
          <div className="mt-1.5 space-y-1.5">
            {liveGames.map((g) => (
              <div key={g.gameId}>
                <div className="flex items-center gap-2">
                  <span
                    className="mono-data text-[12px]"
                    style={{ color: 'var(--t1)', filter: scoresGated ? 'blur(4px)' : 'none', userSelect: scoresGated ? 'none' : 'auto' }}
                  >
                    {g.awayTeam} {g.awayScore} – {g.homeTeam} {g.homeScore}
                  </span>
                  <span className="mono-data text-[10px]" style={{ color: 'var(--t3)' }}>
                    {g.statusState === 'post' ? 'FINAL' : `Q${g.period} ${g.displayClock}`}
                  </span>
                </div>
                {/* UX Behavior Spec Gap #1: never blurred — why this game
                    is yours, not the score itself, so it isn't Pro-gated. */}
                {playerSummary(g.relevantPlayers) && (
                  <p className="text-[11px] mt-0.5" style={{ color: 'var(--t2)' }}>
                    {playerSummary(g.relevantPlayers)}
                  </p>
                )}
              </div>
            ))}
          </div>
          {scoresGated && (
            <p className="mono-data text-[10px] mt-2" style={{ color: 'var(--signal)' }}>
              Unlock live scores with Pro
            </p>
          )}
        </div>
      )}

      {/* T-108: Film Room recap — 6.13's deliberately quietest palette, no
          glow/pulse, "what happened" never "what you missed" (non-punitive
          per Section 7). Sleeper-only, real matchup data for the most
          recently completed week. */}
      {rostiroState === 'film_room' && filmRoomResults.length > 0 && (
        <div
          className="rounded-xl px-4 py-3 mb-4"
          style={{ backgroundColor: 'rgba(8, 15, 26, 0.6)', border: '1px solid var(--hairline)', borderLeft: `2.5px solid ${STATE_CONFIG.film_room.color}` }}
        >
          <span
            className="mono-data text-[9.5px] tracking-[0.16em]"
            style={{ color: STATE_CONFIG.film_room.color }}
          >
            FILM ROOM
          </span>
          <div className="mt-1.5 space-y-2.5">
            {filmRoomResults.map((r) => (
              <div key={r.leagueId}>
                <p className="text-[12.5px]" style={{ color: 'var(--t1)' }}>
                  {r.won === true ? 'You won this week' : r.won === false ? 'Not your week' : 'Even split'} — {r.leagueName}
                </p>
                <p className="mono-data text-[11px] mt-0.5" style={{ color: 'var(--t2)' }}>
                  {r.myScore.toFixed(1)} – {r.opponentScore.toFixed(1)}
                </p>
                {/* T-95: Claude-narrated recap — the result and usage signal
                    above are both computed deterministically; this is only
                    ever the plain-English explanation of them. */}
                {r.recap && (
                  <p className="text-[12px] mt-1.5 leading-relaxed" style={{ color: 'var(--t2)' }}>
                    {r.recap}
                  </p>
                )}
                {/* Buy-low/sell-high usage signal — deliberately understated
                    (no glow, no bright semantic color) to match Film Room's
                    quietest palette; the arrow carries the direction. */}
                {r.usageSignal && (
                  <p className="mono-data text-[10.5px] mt-1.5" style={{ color: 'var(--t3)' }}>
                    {r.usageSignal.direction === 'buy_low' ? '↑' : '↓'} {r.usageSignal.name}
                    {r.usageSignal.position ? ` (${r.usageSignal.position})` : ''} — snap share{' '}
                    {r.usageSignal.direction === 'buy_low' ? 'up' : 'down'} {r.usageSignal.deltaPct}pts
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Mode label — only show in Focused so user knows what they're seeing */}
      {mode === 'focused' && items.length > 0 && (
        <div className="mb-4 flex items-center gap-2">
          <div className="h-px flex-1" style={{ backgroundColor: 'var(--hairline)' }} />
          <span className="mono-data text-[9px] tracking-[0.18em]" style={{ color: 'var(--t3)' }}>
            {items.length} ITEMS · FOCUSED
          </span>
          <div className="h-px flex-1" style={{ backgroundColor: 'var(--hairline)' }} />
        </div>
      )}

      {/* Body */}
      {loading && <LoadingState />}
      {!loading && error && <ErrorState message={error} />}
      {!loading && !error && leagueCount === 0 && <NoLeaguesState totalLeagueCount={totalLeagueCount} />}
      {!loading && !error && leagueCount > 0 && items.length === 0 && (
        <AllClearState doneToday={doneToday} />
      )}
      {!loading && items.length > 0 && (
        <div className={mode === 'balanced' ? 'space-y-3' : 'space-y-2'}>
          {displayItems.map((item) => (
            <PulseCard
              key={item.id}
              item={item}
              mode={mode}
              isLeaving={leaving.has(item.id)}
              isReprioritized={isMissionBriefing && item.type === 'waiver_alert'}
              onOpen={() => setDetail(item)}
              onAction={persistent ? handleAction : null}
            />
          ))}
        </div>
      )}

      {detail && (
        <DetailDrawer
          item={detail}
          onClose={() => setDetail(null)}
          onAction={persistent ? handleAction : null}
        />
      )}
    </div>
  )
}

// UX Behavior Spec Gap #1: "Hurts, Barkley (2 leagues)" — names every
// rostered player that made this game relevant, and how many distinct
// leagues they span.
function playerSummary(players: LiveGameScore['relevantPlayers']): string {
  if (!players || players.length === 0) return ''
  const names = players.map((p) => p.name).join(', ')
  const leagueCount = new Set(players.flatMap((p) => p.leagueNames)).size
  return leagueCount > 0 ? `${names} (${leagueCount} ${leagueCount === 1 ? 'league' : 'leagues'})` : names
}

function greeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

// ─── PulseCard — renders differently per mode ─────────────────────────────────

type ActionHandler = ((item: PulseItem, action: PulseAction) => void) | null

function PulseCard({
  item,
  mode,
  isLeaving,
  isReprioritized,
  onOpen,
  onAction,
}: {
  item: PulseItem
  mode: Mode
  isLeaving: boolean
  isReprioritized: boolean
  onOpen: () => void
  onAction: ActionHandler
}) {
  const typeConf = TYPE_CONFIG[item.type]

  return (
    <article
      onClick={onOpen}
      onKeyDown={(e) => { if (e.key === 'Enter') onOpen() }}
      tabIndex={0}
      className={`glass card-hover relative rounded-xl cursor-pointer ${isLeaving ? 'card-leave' : isReprioritized ? 'waiver-reflow-in' : ''} ${mode === 'savant' ? 'p-3 pl-[18px]' : 'px-4 py-3 pl-[18px]'}`}
    >
      {/* Glowing priority stripe — Waiver Day (T-94): reprioritized waiver
          targets get the opportunity-green Mission Briefing accent instead
          of their ordinary priority color, reinforcing why they moved. */}
      <span
        aria-hidden="true"
        className="absolute left-0 top-2.5 bottom-2.5 w-[2.5px] rounded-full"
        style={
          isReprioritized
            ? { backgroundColor: STATE_CONFIG.waiver_day.color, boxShadow: `0 0 8px ${STATE_CONFIG.waiver_day.color}99` }
            : { backgroundColor: PRIORITY_COLOR[item.priority], boxShadow: PRIORITY_GLOW[item.priority] }
        }
      />

      <div className="flex items-start justify-between gap-2.5">
        <div className="min-w-0">
          <p className={`font-semibold leading-tight ${mode === 'focused' ? 'text-[13px] truncate' : 'text-[13.5px]'}`} style={{ color: 'var(--t1)' }}>
            {item.headline}
          </p>
          <p className="mono-data text-[10px] mt-1" style={{ color: 'var(--t3)' }}>
            {leagueLabel(item).toUpperCase()}
            {item.platform ? ` · ${item.platform.toUpperCase()}` : ''}
          </p>
        </div>
        <span
          className="mono-data text-[8.5px] tracking-[0.16em] px-1.5 py-0.5 rounded flex-shrink-0"
          style={{ color: typeConf.color, backgroundColor: 'color-mix(in srgb, currentColor 12%, transparent)' }}
        >
          {typeConf.label}
        </span>
      </div>

      {mode !== 'focused' && (
        <p className="text-[12.5px] mt-2 leading-normal" style={{ color: 'var(--t2)', maxWidth: '60ch' }}>
          {item.reasoning}
        </p>
      )}

      <div className="flex items-center justify-between gap-2 mt-2.5 flex-wrap">
        <div className="flex items-center gap-1.5">
          {item.actionUrl && (
            <a
              href={item.actionUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="mono-data text-[10.5px] px-2.5 py-1 rounded-[7px] transition-all hover:shadow-[0_0_12px_rgba(75,163,245,.25)]"
              style={{ color: 'var(--signal)', border: '1px solid rgba(75,163,245,.35)' }}
            >
              Open ↗
            </a>
          )}
          {mode === 'savant' && (
            <span className="mono-data text-[10px] ml-1" style={{ color: 'var(--t3)' }}>
              {item.deadline
                ? `DEADLINE ${new Date(item.deadline).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).toUpperCase()}`
                : new Date(item.createdAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
            </span>
          )}
        </div>
        <ActionRow item={item} onAction={onAction} />
      </div>
    </article>
  )
}

function leagueLabel(item: PulseItem): string {
  if (item.affectedLeagues.length === 1) return item.affectedLeagues[0].leagueName
  return `${item.affectedLeagues.length} leagues`
}

// Done / Snooze / Dismiss — hidden entirely in live-only mode (onAction null)
function ActionRow({ item, onAction }: { item: PulseItem; onAction: ActionHandler }) {
  if (!onAction) return null
  return (
    <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
      <button
        onClick={() => onAction(item, 'done')}
        className="mono-data text-[10.5px] px-2.5 py-1 rounded-[7px] transition-all hover:shadow-[0_0_12px_rgba(67,192,119,.25)]"
        style={{ color: 'var(--live)', border: '1px solid rgba(67,192,119,.35)' }}
      >
        ✓ Done
      </button>
      <button
        onClick={() => onAction(item, 'snooze')}
        className="mono-data text-[10.5px] px-2.5 py-1 rounded-[7px] transition-all"
        style={{ color: 'var(--t2)', border: '1px solid var(--hairline)' }}
      >
        Snooze
      </button>
      <button
        onClick={() => onAction(item, 'dismiss')}
        aria-label="Dismiss"
        className="mono-data text-[10.5px] px-2 py-1 rounded-[7px] transition-all hover:text-[var(--t1)]"
        style={{ color: 'var(--t3)' }}
      >
        ✕
      </button>
    </div>
  )
}

// ─── Detail drawer — glass layer over the receded queue ──────────────────────

function DetailDrawer({
  item,
  onClose,
  onAction,
}: {
  item: PulseItem
  onClose: () => void
  onAction: ActionHandler
}) {
  const typeConf = TYPE_CONFIG[item.type]
  const drawerRef = useRef<HTMLElement>(null)
  useFocusTrap(true, drawerRef)

  // Portaled to document.body — this component renders deep inside
  // AppShell's `.relative.z-10` main-content wrapper, which establishes its
  // own CSS stacking context. `fixed` positioning escapes normal layout
  // flow but NOT a stacking context, so this drawer's z-40 was being
  // evaluated inside that z-10 context instead of against the real root —
  // capping it below the System Bar's z-20 and causing the two to overlap
  // visually (found via a screenshot: system bar text bleeding through the
  // drawer's own header). Portaling escapes the ancestor context entirely.
  return createPortal(
    <div
      className="fixed inset-0 z-40 flex justify-end"
      style={{
        backgroundColor: 'rgba(3, 7, 13, 0.45)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
      }}
      onClick={onClose}
    >
      <aside
        ref={drawerRef}
        className="glass-heavy panel-enter w-full max-w-[380px] h-full overflow-y-auto p-6 relative"
        style={{ boxShadow: '-30px 0 70px rgba(0,0,0,.45)' }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Item detail"
        tabIndex={-1}
      >
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute top-3.5 right-3.5 px-2 py-1 text-[15px]"
          style={{ color: 'var(--t3)' }}
        >
          ✕
        </button>

        <span className="mono-data text-[9px] tracking-[0.16em]" style={{ color: typeConf.color }}>
          {typeConf.label}
        </span>
        <h2 className="text-[17px] font-semibold mt-2 leading-snug" style={{ color: 'var(--t1)', textWrap: 'balance' }}>
          {item.headline}
        </h2>
        <p className="mono-data text-[10px] mt-1.5" style={{ color: 'var(--t3)' }}>
          {leagueLabel(item).toUpperCase()}
          {item.platform ? ` · ${item.platform.toUpperCase()}` : ''}
        </p>

        <p className="text-[12.5px] mt-4 leading-relaxed" style={{ color: 'var(--t2)' }}>
          {item.reasoning}
        </p>

        <div className="mono-data mt-4 rounded-[10px] px-3.5 py-3 text-[11px] space-y-1.5" style={{ border: '1px solid var(--hairline)' }}>
          <div className="flex justify-between">
            <span style={{ color: 'var(--t3)' }}>PRIORITY</span>
            <span style={{ color: PRIORITY_COLOR[item.priority] }}>{item.priority.toUpperCase()}</span>
          </div>
          {item.deadline && (
            <div className="flex justify-between">
              <span style={{ color: 'var(--t3)' }}>DEADLINE</span>
              <span style={{ color: 'var(--t1)' }}>
                {new Date(item.deadline).toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).toUpperCase()}
              </span>
            </div>
          )}
          <div className="flex justify-between">
            <span style={{ color: 'var(--t3)' }}>SURFACED</span>
            <span style={{ color: 'var(--t1)' }}>
              {new Date(item.createdAt).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).toUpperCase()}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1.5 mt-5 flex-wrap">
          {item.actionUrl && (
            <a
              href={item.actionUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mono-data text-[10.5px] px-3 py-1.5 rounded-[7px] transition-all hover:shadow-[0_0_12px_rgba(75,163,245,.25)]"
              style={{ color: 'var(--signal)', border: '1px solid rgba(75,163,245,.35)' }}
            >
              Open ↗
            </a>
          )}
          {onAction && (
            <>
              <button
                onClick={() => onAction(item, 'done')}
                className="mono-data text-[10.5px] px-3 py-1.5 rounded-[7px] transition-all hover:shadow-[0_0_12px_rgba(67,192,119,.25)]"
                style={{ color: 'var(--live)', border: '1px solid rgba(67,192,119,.35)' }}
              >
                ✓ Mark done
              </button>
              <button
                onClick={() => onAction(item, 'snooze')}
                className="mono-data text-[10.5px] px-3 py-1.5 rounded-[7px]"
                style={{ color: 'var(--t2)', border: '1px solid var(--hairline)' }}
              >
                Snooze 24h
              </button>
            </>
          )}
        </div>
      </aside>
    </div>,
    document.body
  )
}

// ─── States ────────────────────────────────────────────────────────────────────

function LoadingState() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="glass h-16 rounded-xl animate-pulse" />
      ))}
    </div>
  )
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="glass rounded-xl p-6 text-center mb-3">
      <p className="text-sm" style={{ color: 'var(--crit)' }}>{message}</p>
    </div>
  )
}

// T-109: leagueCount === 0 here means "zero Sleeper leagues," which isn't
// the same thing as "zero leagues" — an ESPN/Yahoo-only account would
// otherwise see this and think nothing is connected at all.
function NoLeaguesState({ totalLeagueCount }: { totalLeagueCount: number }) {
  const hasOtherLeagues = totalLeagueCount > 0
  return (
    <div className="glass rounded-xl p-6 text-center">
      <p className="text-sm font-medium" style={{ color: 'var(--t1)' }}>
        {hasOtherLeagues ? 'Pulse needs a Sleeper league.' : 'Connect a league to activate Pulse.'}
      </p>
      <p className="text-sm mt-1" style={{ color: 'var(--t2)' }}>
        {hasOtherLeagues
          ? `You have ${totalLeagueCount} ${totalLeagueCount === 1 ? 'league' : 'leagues'} connected, but Pulse currently runs on Sleeper leagues only. Connect a Sleeper league to activate it here.`
          : 'Once a Sleeper league is connected, Rostiro checks it every time you open this page.'}
      </p>
      <a
        href="/leagues/add"
        className="inline-block text-sm font-semibold px-4 py-2 rounded-lg mt-4 transition-all hover:shadow-[0_0_18px_rgba(75,163,245,0.35)]"
        style={{ backgroundColor: 'var(--signal-dim)', color: 'var(--signal)', border: '1px solid rgba(75,163,245,.4)' }}
      >
        {hasOtherLeagues ? 'Add a Sleeper league →' : 'Connect a league →'}
      </a>
    </div>
  )
}

function AllClearState({ doneToday }: { doneToday: number }) {
  return (
    <div className="glass rounded-xl p-6 text-center">
      <p className="text-sm font-medium" style={{ color: 'var(--t1)' }}>
        {doneToday > 0 ? `Queue cleared — ${doneToday} handled today.` : 'Nothing needs you right now.'}
      </p>
      <p className="text-sm mt-1" style={{ color: 'var(--t2)' }}>
        {doneToday > 0
          ? 'New intelligence lands here as soon as something changes.'
          : 'No injuries on your rosters and no standout waiver adds. Check back later.'}
      </p>
    </div>
  )
}
