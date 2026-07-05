'use client'

// T-64.1: Draft Copilot live companion. Polls picks every 3s — bumped down
// from 5s (and a since-corrected comment claiming 10s) after founder
// feedback live, mid-draft (July 4, 2026): a bot-heavy fast draft moves
// quicker than a 5s poll can visibly track. Still well inside Sleeper's own
// "stay under 1,000 req/min" ceiling (3s = 20 req/min). Best-available,
// turn countdown, run detection, and snipe detection are all computed
// locally from that poll — no extra API calls per view. Claude is only
// called once, pre-fetched a few picks before the manager's turn, per PRD
// 6.3.1.

import { use, useEffect, useMemo, useRef, useState } from 'react'
import {
  computeBestAvailable,
  computeMyPickNumbers,
  detectPositionRun,
  findSnipedQueueTargets,
  picksUntilMyTurn,
  STRATEGY_LABELS,
  type PositionRun,
} from '@/lib/draftBoard'
import { useMode } from '@/components/nav/AppShell'
import type { ADPPlayer, DraftPick, DraftSettings, DraftStrategy, NFLPosition, Platform } from '@/types'
import type { DraftPickRecommendation } from '@/lib/claude'

const POLL_INTERVAL_MS = 3_000
const PREFETCH_THRESHOLD = 3
const NEEDED_POSITIONS: NFLPosition[] = ['QB', 'RB', 'WR', 'TE', 'K']

export default function DraftSessionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: sessionId } = use(params)
  const mode = useMode()

  const [settings, setSettings] = useState<DraftSettings | null>(null)
  const [queue, setQueue] = useState<string[]>([])
  const [pool, setPool] = useState<ADPPlayer[]>([])
  const [picks, setPicks] = useState<DraftPick[]>([])
  const [myPicks, setMyPicks] = useState<DraftPick[]>([])
  const [currentPickNumber, setCurrentPickNumber] = useState(1)
  const [recommendations, setRecommendations] = useState<DraftPickRecommendation[]>([])
  const [error, setError] = useState<string | null>(null)
  const [positionFilter, setPositionFilter] = useState<NFLPosition | 'ALL'>('ALL')

  const recommendedForPick = useRef<number | null>(null)
  const recommendedPlayerIds = useRef<Set<string>>(new Set())
  const seenSnipes = useRef<Set<string>>(new Set())
  const [freshSnipes, setFreshSnipes] = useState<string[]>([])
  const pollRef = useRef<() => void>(() => {})

  // Load session settings + queue, and the full ADP pool, once.
  useEffect(() => {
    fetch(`/api/draft/session/${sessionId}`)
      .then((res) => res.json())
      .then((data) => {
        setSettings(data.session.settings_json)
        setQueue(data.session.queue_json ?? [])
      })
      .catch(() => setError('Failed to load draft session'))

    fetch('/api/draft/players')
      .then((res) => res.json())
      .then((data: { players: ADPPlayer[] }) => setPool(data.players))
      .catch(() => setError('Failed to load player pool'))
  }, [sessionId])

  const [polling, setPolling] = useState(false)

  // Poll picks on an interval, plus a manual refresh for "check right now."
  useEffect(() => {
    let cancelled = false

    async function poll() {
      setPolling(true)
      try {
        const res = await fetch(`/api/draft/session/${sessionId}/picks`)
        const data = await res.json()
        if (cancelled) return
        if (!res.ok) throw new Error(data.error ?? 'Failed to poll picks')
        setPicks(data.picks)
        setMyPicks(data.myPicks)
        setCurrentPickNumber(data.currentPickNumber)
        setError(null)
      } catch {
        if (!cancelled) setError('Lost connection to the draft — retrying...')
      } finally {
        if (!cancelled) setPolling(false)
      }
    }

    pollRef.current = poll
    poll()
    const interval = setInterval(poll, POLL_INTERVAL_MS)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [sessionId])

  const draftedIds = useMemo(() => new Set(picks.map((p) => p.playerId)), [picks])

  const rosterCounts = useMemo(() => {
    const counts: Partial<Record<NFLPosition, number>> = {}
    for (const p of myPicks) counts[p.position] = (counts[p.position] ?? 0) + 1
    return counts
  }, [myPicks])

  const rosterNeeds = useMemo(() => {
    const needs: Partial<Record<NFLPosition, number>> = {}
    if (!settings) return needs
    for (const slot of settings.rosterSlots) {
      const pos = slot as NFLPosition
      if (NEEDED_POSITIONS.includes(pos)) needs[pos] = (needs[pos] ?? 0) + 1
    }
    return needs
  }, [settings])

  const currentRound = settings ? Math.ceil(currentPickNumber / settings.teamCount) : 1
  const strategy: DraftStrategy = settings?.strategy ?? 'balanced'

  const bestAvailable = useMemo(
    () => computeBestAvailable(pool, draftedIds, rosterNeeds, rosterCounts, strategy, currentRound),
    [pool, draftedIds, rosterNeeds, rosterCounts, strategy, currentRound]
  )

  const queueSet = useMemo(() => new Set(queue), [queue])

  // Queued players (starred by hand, or auto-queued from Copilot Signal
  // below) get their own "My Queue" list — excluded here so Best Available
  // reads as "what's left to consider," not a duplicate of the queue.
  const filteredBestAvailable = useMemo(
    () =>
      bestAvailable.filter(
        (r) => !queueSet.has(r.player.playerId) && (positionFilter === 'ALL' || r.player.position === positionFilter)
      ),
    [bestAvailable, positionFilter, queueSet]
  )

  // My Queue — every queued player still actually available, ADP order
  // (bestAvailable's own sort), regardless of position filter; a shortlist
  // isn't something you want narrowed by whatever tab happens to be active.
  const myQueue = useMemo(
    () => bestAvailable.filter((r) => queueSet.has(r.player.playerId)),
    [bestAvailable, queueSet]
  )

  // Copilot Signal (renamed from an unlabeled recommendation list, per
  // founder feedback watching a real draft): Claude never produces its own
  // ranking (PRD 10.1 — deterministic first, AI second), it only narrates
  // the order bestAvailable already computed. This rank lookup makes that
  // fact visible instead of implicit — a #1/#2/#3 badge next to each
  // recommendation proves it's the algorithm's live order, not a second,
  // competing opinion from Claude.
  const rankByPlayerId = useMemo(
    () => new Map(bestAvailable.map((r, i) => [r.player.playerId, i + 1])),
    [bestAvailable]
  )

  const myPickNumbers = useMemo(
    () => (settings ? computeMyPickNumbers(settings.myDraftPosition, settings.teamCount, settings.totalRounds) : []),
    [settings]
  )
  const picksLeft = picksUntilMyTurn(myPickNumbers, currentPickNumber)

  function changeStrategy(next: DraftStrategy) {
    setSettings((prev) => (prev ? { ...prev, strategy: next } : prev))
    fetch(`/api/draft/session/${sessionId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ strategy: next }),
    }).catch(() => {
      // Best-effort, same as queue persistence — the session still works locally either way
    })
  }

  const positionRun: PositionRun | null = useMemo(() => detectPositionRun(picks), [picks])

  // Founder feedback, live mid-draft (July 4, 2026): the page showed the
  // user's own recommendations and roster, but nothing about what other
  // teams were actually doing — "we don't see the intel we should be
  // seeing from other teams' picks." Most recent first, capped at 10 —
  // this is a glance-at feed, not a full draft log.
  const recentPicks = useMemo(
    () => [...picks].sort((a, b) => b.pickNumber - a.pickNumber).slice(0, 10),
    [picks]
  )

  // Track newly-sniped queue targets (only alert once per player).
  useEffect(() => {
    const sniped = findSnipedQueueTargets(queue, draftedIds)
    const fresh = sniped.filter((id) => !seenSnipes.current.has(id))
    if (fresh.length > 0) {
      fresh.forEach((id) => seenSnipes.current.add(id))
      setFreshSnipes((prev) => [...prev, ...fresh])
      setQueue((prev) => prev.filter((id) => !sniped.includes(id)))
    }
  }, [draftedIds, queue])

  // Only force a full clear+refetch once every recommended candidate is
  // gone — a single sniped player still leaves 4 valid ones, which the
  // render below already filters out via draftedIds.has(rec.playerId), no
  // API call needed. Found live, mid-draft (July 4, 2026): this used to
  // fire on *any* single snipe (.some), which meant every bot pick that
  // happened to touch one of the 5 shown candidates cleared the whole
  // panel and fired a brand new Claude call — in a bot-heavy fast draft
  // that's a lot of calls in a short window, real cost, and exactly what
  // was hitting the recommend route's own rate limit (T-76) and reading
  // as recommendations "vanishing" with no visible error (the fetch's
  // catch is deliberately silent).
  useEffect(() => {
    if (recommendedPlayerIds.current.size === 0) return
    const allDrafted = [...recommendedPlayerIds.current].every((id) => draftedIds.has(id))
    if (allDrafted) {
      recommendedForPick.current = null
      recommendedPlayerIds.current = new Set()
      setRecommendations([])
    }
  }, [draftedIds])

  // Pre-fetch recommendations once we're within range of the manager's turn.
  //
  // Found via a real live draft (July 4, 2026): picking 1st overall meant
  // picksLeft was already 0 on the very first render, before the player
  // pool (fetched async in a separate effect) had finished loading. This
  // effect's guard reads bestAvailable.length, but its dependency array
  // only listed [picksLeft, currentPickNumber] — neither of which change
  // again once you're sitting at pick 1 with nobody else having picked
  // yet, so the one invocation that bailed on an empty pool never got a
  // second chance. Anyone picking later never hit this: by the time
  // picksLeft naturally counted down to the threshold, other teams' picks
  // had already given the pool plenty of time to load. Fixed by making
  // bestAvailable itself a dependency, so pool finishing load re-triggers
  // this even when picksLeft/currentPickNumber were already sitting still.
  useEffect(() => {
    if (picksLeft === null || picksLeft > PREFETCH_THRESHOLD || bestAvailable.length === 0) return
    const targetPick = currentPickNumber + picksLeft
    if (recommendedForPick.current === targetPick) return
    recommendedForPick.current = targetPick

    const candidates = bestAvailable.slice(0, 5)
    recommendedPlayerIds.current = new Set(candidates.map((r) => r.player.playerId))

    fetch(`/api/draft/session/${sessionId}/recommend`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        round: currentRound,
        pickNumber: targetPick,
        strategy,
        rosterSoFar: myPicks.map((p) => ({ name: p.playerName, position: p.position })),
        candidates: candidates.map((r) => ({
          playerId: r.player.playerId,
          name: r.player.name,
          position: r.player.position,
          adp: r.player.overallRank,
        })),
        mode,
      }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.recommendations) setRecommendations(data.recommendations)
      })
      .catch(() => {
        // Silent — the deterministic best-available board still works without Claude's reasoning
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [picksLeft, currentPickNumber, bestAvailable])

  function persistQueue(next: string[]) {
    setQueue(next)
    fetch(`/api/draft/session/${sessionId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ queue: next }),
    }).catch(() => {
      // Persisting the queue is best-effort — it still works client-side for this session
    })
  }

  function toggleQueue(playerId: string) {
    const next = queue.includes(playerId) ? queue.filter((id) => id !== playerId) : [...queue, playerId]
    persistQueue(next)
  }

  // Real founder feedback, live during a real draft (July 6, 2026): starring
  // a player did nothing visible beyond a snipe alert later — "what is our
  // behavior here... they don't go anywhere else?" Two changes close that
  // gap: Copilot's own recommendations now auto-queue themselves (so the
  // AI's picks and the user's hand-picks land in the exact same place, one
  // shortlist, not two competing ones), and the Best Available list below
  // excludes anything already queued (rendered separately in "My Queue"),
  // so starring a player now visibly moves them out of the noise instead of
  // just toggling an icon in place.
  useEffect(() => {
    if (recommendations.length === 0) return
    // Deferred rather than called directly in the effect body — same
    // react-hooks/set-state-in-effect avoidance used elsewhere in this app
    // (e.g. lib/useLiveUnlockTransition.ts).
    const t = window.setTimeout(() => {
      const newIds = recommendations.map((r) => r.playerId).filter((id) => !queue.includes(id))
      if (newIds.length > 0) persistQueue([...queue, ...newIds])
    }, 0)
    return () => window.clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recommendations])

  if (error && !settings) {
    return (
      <div className="max-w-2xl mx-auto px-4 pt-12 text-center">
        <p className="text-sm" style={{ color: 'var(--crit)' }}>{error}</p>
      </div>
    )
  }

  const poolByPlayerId = new Map(pool.map((p) => [p.playerId, p]))
  const showPanicPanel = picksLeft !== null && picksLeft <= PREFETCH_THRESHOLD

  // Founder feedback, live mid-draft (July 4, 2026): "My roster" trailed
  // below a long, unbounded best-available list, meaning it was only
  // reachable by scrolling past everything else — a real cost during a
  // timed pick. Restructured into a cockpit layout: a bounded-height,
  // internally-scrolling board on the left, roster pinned in a sidebar on
  // the right (lg+) so it's visible the whole time without scrolling to
  // find it. Below lg, there's genuinely not enough width for two columns
  // side by side — falls back to stacked, same as before.
  //
  // Real bug found live during a real draft (July 5, 2026): the fixed-
  // height/internal-scroll mechanism (h-full, flex-1 min-h-0) was applied
  // UNCONDITIONALLY, not gated to lg+ — so "falls back to stacked" never
  // actually delivered normal page scroll below lg. CSS Grid's row-stretch
  // behavior (which is what let a bare min-h-0/flex-1 pair size correctly
  // at lg+, both columns sharing one row's height) only applies when the
  // two panels sit in the SAME grid row (the lg+ 2-column case) — stacked
  // to grid-cols-1, they become two separate auto-height rows, and a
  // flex-1 min-h-0 descendant inside an auto-height row has nothing real
  // to size against, so it collapsed instead of scrolling: the ADP list
  // rendered a sliver, unreachable by any scroll. Fixed by switching the
  // row to flexbox (flex-col below lg, flex-row at lg+) and gating every
  // height-constraining class to lg: — below lg now genuinely falls back
  // to natural block height, letting <main>'s own page-level scroll (in
  // AppShell.tsx) reach everything, exactly as the comment always intended.
  return (
    <div className="max-w-6xl mx-auto px-4 pt-6 pb-4 md:px-6 md:pt-8 flex flex-col lg:h-full lg:min-h-0">
      <TurnHeader
        round={currentRound}
        pickNumber={currentPickNumber}
        picksLeft={picksLeft}
        draftId={settings?.draftId ?? null}
        platform={settings?.platform ?? null}
        onRefresh={() => pollRef.current()}
        refreshing={polling}
      />

      {positionRun && (
        <AlertBanner
          color="#F5A623"
          text={`${positionRun.position} run in progress — ${positionRun.count} of the last ${positionRun.windowSize} picks were ${positionRun.position}.`}
        />
      )}

      {freshSnipes.length > 0 && (
        <AlertBanner
          color="#E8504A"
          text={`Your queued target${freshSnipes.length > 1 ? 's were' : ' was'} just drafted by someone else. Check the best-available list below for your next option.`}
          onDismiss={() => setFreshSnipes([])}
        />
      )}

      <div className="flex flex-col lg:flex-row lg:flex-1 lg:min-h-0 gap-4">
      <div className="flex flex-col lg:flex-1 lg:min-h-0">

      {showPanicPanel && (
        // T-104 / 6.13: Draft State's accent — matches the already-shipped
        // STATE_CONFIG.draft amber (PulseMark/System Bar), not the PRD 6.13
        // text's "opportunity green," which was never reconciled with the
        // real STATE_CONFIG values.
        <div
          className="rounded-xl p-4 mb-4 flex-shrink-0"
          style={{ backgroundColor: 'rgba(8, 15, 26, 0.6)', border: '1px solid #EF9F27', borderLeft: '3px solid #EF9F27' }}
        >
          <p className="text-xs font-semibold tracking-widest uppercase mb-3" style={{ color: '#EF9F27' }}>
            {picksLeft === 0 ? "You're on the clock" : `Your turn in ${picksLeft} pick${picksLeft === 1 ? '' : 's'}`}
          </p>

          <div className="flex items-center gap-2 mb-2.5">
            <span className="mono-data text-[9px] tracking-[0.16em]" style={{ color: 'var(--signal)' }}>
              COPILOT SIGNAL
            </span>
            <span className="h-px flex-1" style={{ backgroundColor: 'var(--hairline)' }} />
          </div>

          {recommendations.length === 0 ? (
            <p className="text-sm" style={{ color: 'var(--t2)' }}>Preparing recommendations...</p>
          ) : (
            // Real bug found live during a real draft (July 6, 2026): this had
            // no height cap, so up to 5 full recommendations (name + 2-line
            // reasoning each) could run 500-700px tall — starving the sibling
            // Best Available list below of nearly all the vertical space in a
            // typical viewport. Tightened further (280px -> 170px) now that
            // every recommendation also auto-queues into "My Queue" (the
            // sidebar) — the full reasoning is still one scroll away, but you
            // no longer need to see all 5 in place just to know what got
            // recommended.
            <div className="space-y-3 max-h-[170px] overflow-y-auto pr-1">
              {recommendations.map((rec) => {
                // Render from the recommendation itself, not the live top-5 —
                // if the board shifted since this was fetched, the
                // draftedIds effect above already cleared and re-fetched;
                // anything still here is still live.
                const p = poolByPlayerId.get(rec.playerId)
                if (!p || draftedIds.has(rec.playerId)) return null
                const rank = rankByPlayerId.get(rec.playerId)
                return (
                  <div key={rec.playerId} className="draft-queue-slide-in flex gap-2.5">
                    <span
                      className="mono-data text-xs font-bold flex-shrink-0 mt-[1px]"
                      style={{ color: 'var(--signal)' }}
                      title="Current deterministic rank — Claude narrates this order, it doesn't set it"
                    >
                      {rank ? `#${rank}` : '–'}
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-white">{p.name} <span className="text-xs font-normal" style={{ color: 'var(--t3)' }}>{p.position} · ADP {p.overallRank}</span></p>
                      <p className="text-sm mt-0.5" style={{ color: 'var(--t2)' }}>{rec.reasoning}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      <div className="flex items-center justify-between gap-2 mb-3 flex-shrink-0">
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {(['ALL', ...NEEDED_POSITIONS] as const).map((pos) => (
            <button
              key={pos}
              onClick={() => setPositionFilter(pos)}
              className="flex-shrink-0 text-xs font-semibold px-3 py-1.5 rounded-lg transition-all"
              style={{
                backgroundColor: positionFilter === pos ? 'var(--signal)' : 'rgba(8, 15, 26, 0.6)',
                color: positionFilter === pos ? 'white' : 'var(--t2)',
                border: `1px solid ${positionFilter === pos ? 'var(--signal)' : 'var(--hairline)'}`,
              }}
            >
              {pos}
            </button>
          ))}
        </div>
        <select
          value={strategy}
          onChange={(e) => changeStrategy(e.target.value as DraftStrategy)}
          className="flex-shrink-0 text-xs font-semibold px-2.5 py-1.5 rounded-lg outline-none"
          style={{ backgroundColor: 'rgba(8, 15, 26, 0.6)', border: '1px solid var(--hairline)', color: 'var(--signal)' }}
        >
          {Object.entries(STRATEGY_LABELS).map(([key, label]) => (
            <option key={key} value={key}>{label}</option>
          ))}
        </select>
      </div>

      {/* T-105 / PRD 3: Focused gets a shorter, quieter list — 5 rows, no
          strategy-weight indicators (a Balanced/Savant supporting stat).
          Savant adds decimal ADP precision, matching the same distinction
          already drawn on the Draft Kit rankings table.
          Bounded + internally scrolling (not mb-4 unbounded) — this is the
          one region genuinely long enough to need its own scroll; nothing
          else on the page should have to compete with it for space. */}
      <div className="rounded-xl overflow-y-auto lg:flex-1 lg:min-h-0" style={{ border: '1px solid var(--hairline)' }}>
        {filteredBestAvailable.slice(0, mode === 'focused' ? 5 : 20).map((r, i) => {
          const p = r.player
          const prevTier = i > 0 ? filteredBestAvailable[i - 1].player.tier : null
          const showTierDivider = p.tier !== prevTier && i > 0

          return (
            <div key={p.playerId}>
              {showTierDivider && (
                <div
                  className="px-4 py-1 text-[10px] font-semibold tracking-widest uppercase"
                  style={{ backgroundColor: 'rgba(6, 11, 19, 0.55)', color: 'var(--t3)' }}
                >
                  Tier {p.tier}
                </div>
              )}
              <div
                className="flex items-center gap-3 px-4 py-2.5"
                style={{ backgroundColor: 'rgba(8, 15, 26, 0.6)', borderTop: i === 0 ? 'none' : '1px solid var(--hairline)' }}
              >
                {/* One-way here — a queued player no longer appears in this
                    list at all (it moved to "My Queue" in the sidebar), so
                    this is always the empty star, never a toggle-in-place. */}
                <button
                  onClick={() => toggleQueue(p.playerId)}
                  className="flex-shrink-0 text-base"
                  style={{ color: 'var(--t3)' }}
                  aria-label="Add to queue"
                >
                  ☆
                </button>
                <span className="text-xs font-semibold flex-shrink-0 w-9" style={{ color: 'var(--t3)' }}>
                  ADP {p.overallRank}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-white truncate">{p.name}</p>
                  <p className="text-xs truncate" style={{ color: 'var(--t3)' }}>{p.position} · {p.nflTeam || 'FA'}</p>
                </div>
                {mode !== 'focused' && r.strategyWeight !== 0 && (
                  <span
                    className="flex-shrink-0 text-xs font-semibold px-1.5 py-0.5 rounded"
                    style={{
                      backgroundColor: r.strategyWeight > 0 ? 'rgba(67,192,119,.1)' : 'rgba(232,80,74,.1)',
                      color: r.strategyWeight > 0 ? 'var(--live)' : 'var(--crit)',
                    }}
                    title={`${STRATEGY_LABELS[strategy]} is ${r.strategyWeight > 0 ? 'boosting' : 'suppressing'} this pick`}
                  >
                    {r.strategyWeight > 0 ? '↑' : '↓'}
                  </span>
                )}
              </div>
            </div>
          )
        })}
      </div>

      </div>

      {/* Sidebar — pinned beside the board (lg+) instead of trailing below
          it, so both are visible the whole draft without scrolling to
          find them. */}
      <div className="flex flex-col gap-4 lg:w-[300px] lg:flex-shrink-0 lg:min-h-0">
        {/* My Queue — every starred player (hand-picked or auto-queued from
            Copilot Signal), segmented out of Best Available entirely rather
            than just toggling an icon in place. Star here removes; the same
            star in Best Available adds. */}
        <div className="flex flex-col min-h-0" style={{ flex: '0 1 auto' }}>
          <h2 className="text-sm font-semibold text-white mb-2 flex-shrink-0">My queue ({myQueue.length})</h2>
          <div className="rounded-xl overflow-y-auto max-h-[220px]" style={{ border: '1px solid var(--hairline)' }}>
            {myQueue.length === 0 ? (
              <div className="px-4 py-3" style={{ backgroundColor: 'rgba(8, 15, 26, 0.6)' }}>
                <p className="text-sm" style={{ color: 'var(--t2)' }}>No targets queued yet — star a player below, or wait for Copilot Signal.</p>
              </div>
            ) : (
              myQueue.map((r, i) => (
                <div
                  key={r.player.playerId}
                  className="flex items-center gap-2.5 px-4 py-2"
                  style={{ backgroundColor: 'rgba(8, 15, 26, 0.6)', borderTop: i === 0 ? 'none' : '1px solid var(--hairline)' }}
                >
                  <button
                    onClick={() => toggleQueue(r.player.playerId)}
                    className="flex-shrink-0 text-base"
                    style={{ color: 'var(--warn)' }}
                    aria-label="Remove from queue"
                  >
                    ★
                  </button>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-white truncate">{r.player.name}</p>
                    <p className="text-xs truncate" style={{ color: 'var(--t3)' }}>{r.player.position} · ADP {r.player.overallRank}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="flex flex-col min-h-0" style={{ flex: '0 1 auto' }}>
          <h2 className="text-sm font-semibold text-white mb-2 flex-shrink-0">Recent picks</h2>
          <div className="rounded-xl overflow-y-auto max-h-[260px]" style={{ border: '1px solid var(--hairline)' }}>
            {recentPicks.length === 0 ? (
              <div className="px-4 py-3" style={{ backgroundColor: 'rgba(8, 15, 26, 0.6)' }}>
                <p className="text-sm" style={{ color: 'var(--t2)' }}>No picks yet.</p>
              </div>
            ) : (
              recentPicks.map((p, i) => (
                <div
                  key={p.pickNumber}
                  className="flex items-center justify-between gap-2 px-4 py-2"
                  style={{
                    backgroundColor: p.isMyPick ? 'var(--signal-dim)' : 'rgba(8, 15, 26, 0.6)',
                    borderTop: i === 0 ? 'none' : '1px solid var(--hairline)',
                  }}
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate" style={{ color: p.isMyPick ? 'var(--signal)' : 'white' }}>
                      {p.playerName} <span className="text-xs font-normal" style={{ color: 'var(--t3)' }}>{p.position}</span>
                    </p>
                    <p className="mono-data text-[10px] mt-0.5" style={{ color: 'var(--t3)' }}>
                      PICK {p.pickNumber} · {p.isMyPick ? 'YOU' : `TEAM ${p.pickedByTeamId}`}
                    </p>
                  </div>
                  {p.adpDelta !== null && Math.abs(p.adpDelta) >= 3 && (
                    <span
                      className="mono-data text-xs font-semibold flex-shrink-0"
                      style={{ color: p.adpDelta > 0 ? 'var(--live)' : 'var(--crit)' }}
                      title={p.adpDelta > 0 ? 'Picked later than ADP — value' : 'Picked earlier than ADP — a reach'}
                    >
                      {p.adpDelta > 0 ? '+' : ''}{Math.round(p.adpDelta)}
                    </span>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        <div className="flex flex-col lg:min-h-0 lg:flex-1">
          <h2 className="text-sm font-semibold text-white mb-2 flex-shrink-0">My roster ({myPicks.length})</h2>
          <div className="rounded-xl overflow-y-auto" style={{ border: '1px solid var(--hairline)' }}>
            {myPicks.length === 0 ? (
              <div className="px-4 py-3" style={{ backgroundColor: 'rgba(8, 15, 26, 0.6)' }}>
                <p className="text-sm" style={{ color: 'var(--t2)' }}>No picks yet.</p>
              </div>
            ) : (
              myPicks.map((p, i) => (
                <div
                  key={p.playerId}
                  className="flex items-center justify-between px-4 py-2.5"
                  style={{ backgroundColor: 'rgba(8, 15, 26, 0.6)', borderTop: i === 0 ? 'none' : '1px solid var(--hairline)' }}
                >
                  <p className="text-sm font-medium text-white">{p.playerName}</p>
                  <span className="text-xs" style={{ color: 'var(--t3)' }}>{p.position} · Round {p.round}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      </div>
    </div>
  )
}

function TurnHeader({
  round,
  pickNumber,
  picksLeft,
  draftId,
  platform,
  onRefresh,
  refreshing,
}: {
  round: number
  pickNumber: number
  picksLeft: number | null
  draftId: string | null
  platform: Platform | null
  onRefresh: () => void
  refreshing: boolean
}) {
  // Not importing lib/yahoo.ts here — it transitively pulls in
  // lib/supabase.ts (next/headers, service-role client), which must never
  // reach the client bundle. Inlined instead of reusing yahooDraftUrl().
  const draftUrl = draftId
    ? platform === 'yahoo'
      ? `https://football.fantasysports.yahoo.com/f1/${draftId.split('.l.')[1]}/draftclient`
      : `https://sleeper.com/draft/nfl/${draftId}`
    : null
  const platformLabel = platform === 'yahoo' ? 'Yahoo' : 'Sleeper'

  return (
    <div className="mb-4 flex items-baseline justify-between">
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight">Draft Copilot</h1>
        <p className="text-sm mt-0.5" style={{ color: 'var(--t2)' }}>
          Round {round} · Pick {pickNumber}
          {picksLeft !== null && (
            <span style={{ color: picksLeft <= 1 ? 'var(--crit)' : picksLeft <= 3 ? 'var(--warn)' : 'var(--t3)' }}>
              {' '}· {picksLeft === 0 ? 'you\'re up' : `${picksLeft} to your turn`}
            </span>
          )}
        </p>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <button
          onClick={onRefresh}
          disabled={refreshing}
          className="text-xs font-semibold px-3 py-1.5 rounded-lg whitespace-nowrap transition-all hover:brightness-110 disabled:opacity-50"
          style={{ backgroundColor: 'var(--hairline)', color: 'var(--t2)' }}
        >
          {refreshing ? 'Checking...' : 'Refresh now'}
        </button>
      {draftUrl && (
        <a
          href={draftUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs font-semibold px-3 py-1.5 rounded-lg whitespace-nowrap transition-all hover:brightness-110"
          style={{ backgroundColor: 'var(--signal-dim)', color: 'var(--signal)' }}
        >
          Draft on {platformLabel} →
        </a>
      )}
      </div>
    </div>
  )
}

function AlertBanner({ color, text, onDismiss }: { color: string; text: string; onDismiss?: () => void }) {
  return (
    <div
      className="rounded-xl px-4 py-3 mb-3 flex items-start justify-between gap-3"
      style={{ backgroundColor: `${color}12`, border: `1px solid ${color}40` }}
    >
      <p className="text-sm" style={{ color }}>{text}</p>
      {onDismiss && (
        <button onClick={onDismiss} className="text-sm flex-shrink-0" style={{ color }}>×</button>
      )}
    </div>
  )
}
