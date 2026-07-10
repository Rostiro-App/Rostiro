'use client'
import type { LiveScenario } from '@/app/demo/lib/liveScenario'

const input = { width: '100%', background: 'rgba(8,15,26,.6)', border: '1px solid var(--hairline)', borderRadius: 8, padding: '6px 8px', color: 'var(--t1)', fontSize: 13 } as const
const lbl = { fontSize: 11, color: 'var(--t3)' } as const

export function LiveAuthorForm({ content, onChange }: { content: LiveScenario; onChange: (s: LiveScenario) => void }) {
  const setP = (i: number, patch: Partial<LiveScenario['players'][number]>) =>
    onChange({ ...content, players: content.players.map((p, j) => (j === i ? { ...p, ...patch } : p)) })
  const setM = (i: number, patch: Partial<LiveScenario['matchups'][number]>) =>
    onChange({ ...content, matchups: content.matchups.map((m, j) => (j === i ? { ...m, ...patch } : m)) })
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <label className="mono-data" style={lbl}>Featured players (editable)</label>
      {content.players.map((p, i) => (
        <div key={p.playerId} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <input style={{ ...input, flex: 2 }} value={p.name} onChange={(e) => setP(i, { name: e.target.value })} />
          <input style={{ ...input, width: 48 }} value={p.nflTeam} onChange={(e) => setP(i, { nflTeam: e.target.value })} />
          <input style={{ ...input, width: 58 }} type="number" step="0.1" value={p.finalPoints} onChange={(e) => setP(i, { finalPoints: Number(e.target.value) })} />
          <input style={{ ...input, width: 40 }} type="number" value={p.tdCount} onChange={(e) => setP(i, { tdCount: Number(e.target.value) })} />
          <input style={{ ...input, width: 80 }} value={p.eventLabel} onChange={(e) => setP(i, { eventLabel: e.target.value })} />
          <button aria-label="Remove" onClick={() => onChange({ ...content, players: content.players.filter((_, j) => j !== i) })} style={{ color: 'var(--t3)' }}>✕</button>
        </div>
      ))}
      <label className="mono-data" style={lbl}>Matchups (opponent final)</label>
      {content.matchups.map((m, i) => (
        <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <input style={{ ...input, flex: 2 }} value={m.leagueName} onChange={(e) => setM(i, { leagueName: e.target.value })} />
          <input style={{ ...input, width: 70 }} type="number" step="0.1" value={m.oppFinal} onChange={(e) => setM(i, { oppFinal: Number(e.target.value), oppProjected: Number(e.target.value) })} />
        </div>
      ))}
    </div>
  )
}
