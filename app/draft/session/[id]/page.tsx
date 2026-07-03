'use client'

// T-64.1: Draft Copilot live companion. Polls picks every 10s (matching
// Sleeper's own recommended cadence); best-available, turn countdown, run
// detection, and snipe detection are all computed locally from that poll —
// no extra API calls per view. Claude is only called once, pre-fetched a few
// picks before the manager's turn, per PRD 6.3.1.

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
import type { ADPPlayer, DraftPick, DraftSettings, DraftStrategy, NFLPosition, Platform } from '@/types'
import type { DraftPickRecommendation } from '@/lib/claude'

const POLL_INTERVAL_MS = 5_000
const PREFETCH_THRESHOLD = 3
const NEEDED_POSITIONS: NFLPosition[] = ['QB', 'RB', 'WR', 'TE', 'K']

export default function DraftSessionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: sessionId } = use(params)

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

  const filteredBestAvailable = useMemo(
    () => (positionFilter === 'ALL' ? bestAvailable : bestAvailable.filter((r) => r.player.position === positionFilter)),
    [bestAvailable, positionFilter]
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

  // If the board shifts enough before the manager's turn that a recommended
  // player is no longer available, the old recommendation set is stale —
  // clear it and let the effect below re-fetch against the current board
  // instead of silently rendering nothing (the bug that showed up live:
  // recommendations were fetched once and never revisited).
  useEffect(() => {
    if (recommendedPlayerIds.current.size === 0) return
    const anyDrafted = [...recommendedPlayerIds.current].some((id) => draftedIds.has(id))
    if (anyDrafted) {
      recommendedForPick.current = null
      recommendedPlayerIds.current = new Set()
      setRecommendations([])
    }
  }, [draftedIds])

  // Pre-fetch recommendations once we're within range of the manager's turn.
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
          adp: r.player.adpConsensus,
        })),
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
  }, [picksLeft, currentPickNumber])

  function toggleQueue(playerId: string) {
    const next = queue.includes(playerId) ? queue.filter((id) => id !== playerId) : [...queue, playerId]
    setQueue(next)
    fetch(`/api/draft/session/${sessionId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ queue: next }),
    }).catch(() => {
      // Persisting the queue is best-effort — it still works client-side for this session
    })
  }

  if (error && !settings) {
    return (
      <div className="max-w-2xl mx-auto px-4 pt-12 text-center">
        <p className="text-sm" style={{ color: 'var(--crit)' }}>{error}</p>
      </div>
    )
  }

  const poolByPlayerId = new Map(pool.map((p) => [p.playerId, p]))
  const showPanicPanel = picksLeft !== null && picksLeft <= PREFETCH_THRESHOLD

  return (
    <div className="max-w-2xl mx-auto px-4 pt-6 pb-16 md:px-6 md:pt-8">
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

      {showPanicPanel && (
        <div
          className="rounded-xl p-4 mb-4"
          style={{ backgroundColor: 'rgba(8, 15, 26, 0.6)', border: '1px solid var(--signal)', borderLeft: '3px solid var(--signal)' }}
        >
          <p className="text-xs font-semibold tracking-widest uppercase mb-3" style={{ color: 'var(--signal)' }}>
            {picksLeft === 0 ? "You're on the clock" : `Your turn in ${picksLeft} pick${picksLeft === 1 ? '' : 's'}`}
          </p>
          {recommendations.length === 0 ? (
            <p className="text-sm" style={{ color: 'var(--t2)' }}>Preparing recommendations...</p>
          ) : (
            <div className="space-y-3">
              {recommendations.map((rec) => {
                // Render from the recommendation itself, not the live top-5 —
                // if the board shifted since this was fetched, the
                // draftedIds effect above already cleared and re-fetched;
                // anything still here is still live.
                const p = poolByPlayerId.get(rec.playerId)
                if (!p || draftedIds.has(rec.playerId)) return null
                return (
                  <div key={rec.playerId}>
                    <p className="text-sm font-semibold text-white">{p.name} <span className="text-xs font-normal" style={{ color: 'var(--t3)' }}>{p.position} · ADP {Math.round(p.adpConsensus)}</span></p>
                    <p className="text-sm mt-0.5" style={{ color: 'var(--t2)' }}>{rec.reasoning}</p>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      <div className="flex items-center justify-between gap-2 mb-3">
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

      <div className="rounded-xl overflow-hidden mb-4" style={{ border: '1px solid var(--hairline)' }}>
        {filteredBestAvailable.slice(0, 20).map((r, i) => {
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
                <button
                  onClick={() => toggleQueue(p.playerId)}
                  className="flex-shrink-0 text-base"
                  style={{ color: queue.includes(p.playerId) ? 'var(--warn)' : 'var(--t3)' }}
                  aria-label="Toggle target"
                >
                  {queue.includes(p.playerId) ? '★' : '☆'}
                </button>
                <span className="text-xs font-semibold flex-shrink-0 w-9" style={{ color: 'var(--t3)' }}>
                  ADP {Math.round(p.adpConsensus)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-white truncate">{p.name}</p>
                  <p className="text-xs truncate" style={{ color: 'var(--t3)' }}>{p.position} · {p.nflTeam || 'FA'}</p>
                </div>
                {r.strategyWeight !== 0 && (
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

      <h2 className="text-sm font-semibold text-white mb-2">My roster ({myPicks.length})</h2>
      <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--hairline)' }}>
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
