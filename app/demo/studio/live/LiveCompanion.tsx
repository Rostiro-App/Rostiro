'use client'
import type { LiveSimFrame, LivePlayerFrame } from '@/app/demo/lib/liveSim'

function PlayerRow({ p }: { p: LivePlayerFrame }) {
  const ring = p.event ? 'var(--live)' : 'transparent'
  return (
    <div className="w-full flex items-center gap-3 px-3 py-2.5 text-left" style={{ borderTop: '1px solid var(--hairline)', backgroundColor: 'rgba(8,15,26,0.6)' }}>
      <img src={p.headshotUrl ?? undefined} alt={p.name} className="w-10 h-10 rounded-full object-cover flex-shrink-0"
        style={{ backgroundColor: 'var(--glass-solid)', border: `2px solid ${ring}`, transition: 'border-color 1s' }}
        onError={(e) => { (e.currentTarget as HTMLImageElement).style.visibility = 'hidden' }} />
      <div className="min-w-0 flex-1">
        <span className="text-sm font-medium text-white truncate block">{p.name}</span>
        <p className="text-xs" style={{ color: 'var(--t3)' }}>{p.pos} · {p.nflTeam}</p>
        <div className="flex flex-wrap gap-1 mt-1">
          {p.leagueChips.map((l, i) => (
            <span key={i} className="mono-data text-[8.5px] font-semibold px-1.5 py-0.5 rounded-full"
              style={l.starting ? { color: 'var(--signal)', border: '1px solid rgba(75,163,245,.4)', backgroundColor: 'var(--signal-dim)' } : { color: 'var(--t3)', border: '1px solid var(--hairline)' }}>
              {l.leagueName}
            </span>
          ))}
        </div>
      </div>
      <div className="text-right flex-shrink-0">
        <p key={`p:${p.playerId}:${p.points}`} className="mono-data text-lg font-bold score-tick-up" style={{ color: 'var(--t1)' }}>{p.points.toFixed(1)}</p>
        <p className="mono-data text-[9.5px]" style={{ color: 'var(--t4)' }}>proj {p.projected.toFixed(1)}</p>
        {p.event && <p className="mono-data text-[9.5px] font-semibold tracking-wide mt-0.5" style={{ color: 'var(--live)' }}>+6.0 {p.event}</p>}
      </div>
    </div>
  )
}

export function LiveCompanion({ frame }: { frame: LiveSimFrame }) {
  return (
    <div className="max-w-2xl mx-auto px-5 md:px-6 pt-6 pb-10">
      <p className="mono-data text-[10px] tracking-widest uppercase mb-2" style={{ color: 'var(--t3)' }}>Live now</p>
      <div className="grid gap-3 md:grid-cols-2 mb-6">
        {frame.games.map((g, i) => (
          <div key={i} className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--hairline)' }}>
            <p className="mono-data text-[10px] px-3 py-1.5" style={{ color: 'var(--t3)', backgroundColor: 'rgba(6,11,19,0.5)' }}>
              {g.away} {g.awayScore} – {g.home} {g.homeScore} · Q{g.period} {g.clock}
            </p>
            {g.players.map((p) => <PlayerRow key={p.playerId} p={p} />)}
          </div>
        ))}
      </div>
      <p className="mono-data text-[10px] tracking-widest uppercase mb-2" style={{ color: 'var(--t3)' }}>Your matchups</p>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {frame.matchups.map((m, i) => (
          <div key={i} className="rounded-lg px-3 py-2 flex-shrink-0" style={{ border: '1px solid var(--hairline)', minWidth: 150 }}>
            <p className="mono-data text-[9px] uppercase" style={{ color: 'var(--t3)' }}>{m.leagueName}</p>
            <div className="flex items-baseline justify-between mt-1">
              <span key={`me:${m.myScore}`} className="mono-data text-sm font-bold score-tick-up" style={{ color: 'var(--live)' }}>{m.myScore.toFixed(1)}</span>
              <span className="mono-data text-[9px]" style={{ color: 'var(--t4)' }}>vs</span>
              <span className="mono-data text-sm" style={{ color: 'var(--t3)' }}>{m.oppScore.toFixed(1)}</span>
            </div>
            <div className="flex items-baseline justify-between mt-0.5">
              <span className="mono-data text-[9px]" style={{ color: 'var(--t4)' }}>proj {m.myProjected.toFixed(1)}</span>
              <span className="mono-data text-[9px]" style={{ color: 'var(--t4)' }}>proj {m.oppProjected.toFixed(1)}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
