'use client'
import { useMemo } from 'react'
import { computeLeagueHealth, type HealthInput } from '@/lib/healthScore'
import { loadFixtures } from '../lib/loadFixtures'
import { DemoCrest } from '../fixtures/crest'

export function StandardState() {
  const { players, league, chat } = useMemo(() => loadFixtures(), [])
  const health = useMemo(() => {
    const byId = new Map(players.map((p) => [p.id, p]))
    const founder = league.managers[0]
    const rostered = new Set(league.managers.flatMap((m) => m.roster))
    const freeAgents = players.filter((p) => !rostered.has(p.id) && p.adp != null)
      .sort((a, b) => (a.adp! - b.adp!))
    const input: HealthInput = {
      myPlayers: founder.roster.map((id) => {
        const p = byId.get(id)
        return { playerId: id, adp: p?.adp ?? null, injuryStatus: null }
      }),
      starterIds: founder.roster.slice(0, 9),
      bestFreeAgentAdp: freeAgents[0]?.adp ?? null,
      bestFreeAgentName: freeAgents[0]?.name ?? null,
    }
    return computeLeagueHealth(input)
  }, [players, league])

  const standings = [...league.managers].sort((a, b) => b.record.w - a.record.w || b.seasonPoints - a.seasonPoints)

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, padding: 24 }}>
      <section>
        <h2 style={{ display: 'flex', gap: 8, alignItems: 'center' }}><DemoCrest size={28} /> Standings</h2>
        <ol>
          {standings.map((m) => (
            <li key={m.managerId} style={{ fontWeight: m.archetype === 'founder' ? 700 : 400 }}>
              {m.teamName} — {m.record.w}-{m.record.l} ({m.seasonPoints.toFixed(1)})
            </li>
          ))}
        </ol>
      </section>
      <section>
        <h2>League Health</h2>
        <div style={{ fontSize: 48, fontWeight: 800 }} data-testid="health-score">{health.score ?? '—'}</div>
        <div>{health.status}</div>
        <h3>Activity</h3>
        <ul>
          {league.managers.slice(0, 4).flatMap((m) => (chat[m.managerId] ?? []).slice(0, 1).map((line, i) => (
            <li key={`${m.managerId}-${i}`}><strong>{m.handle}:</strong> {line}</li>
          )))}
        </ul>
      </section>
    </div>
  )
}
