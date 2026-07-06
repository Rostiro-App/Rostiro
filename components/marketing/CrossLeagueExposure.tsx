// Marketing/education visual for Features Pillar 1's Savant pitch: makes
// the "portfolio, not separate teams" idea concrete with one real-shaped
// example instead of only asserting it in the pitch copy above it. Static,
// sample data only, no fetch — same posture as DataJoinDiagram.tsx.

const LEAGUES = [
  { platform: 'Sleeper', team: 'Dynasty Kings', role: 'RB1', points: 18.4 },
  { platform: 'ESPN', team: 'The Comeback', role: 'FLEX', points: 11.2 },
  { platform: 'Yahoo', team: 'Gridiron Co.', role: 'RB2', points: 17.6 },
]

const TOTAL = LEAGUES.reduce((sum, l) => sum + l.points, 0)

export default function CrossLeagueExposure() {
  return (
    <div className="glass rounded-xl p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="mono-data text-[10px] tracking-[0.1em] uppercase" style={{ color: 'var(--t4)' }}>
            Cross-league exposure
          </p>
          <p className="text-base font-bold mt-1" style={{ color: 'var(--t1)' }}>
            Christian McCaffrey
          </p>
        </div>
        <div className="text-right">
          <p className="mono-data text-2xl font-bold" style={{ color: 'var(--signal)' }}>
            {TOTAL.toFixed(1)}
          </p>
          <p className="mono-data text-[10px] uppercase" style={{ color: 'var(--t4)' }}>
            total pts this week
          </p>
        </div>
      </div>

      <div className="mt-5 space-y-2.5">
        {LEAGUES.map((l) => {
          const widthPct = (l.points / TOTAL) * 100
          return (
            <div key={l.platform} className="flex items-center gap-3">
              <span
                className="mono-data text-[10px] font-bold uppercase w-14 flex-shrink-0"
                style={{ color: 'var(--t3)' }}
              >
                {l.platform}
              </span>
              <div className="flex-1 h-6 rounded-md relative overflow-hidden" style={{ backgroundColor: 'var(--glass-solid)' }}>
                <div
                  className="h-full rounded-md flex items-center px-2"
                  style={{ width: `${widthPct}%`, backgroundColor: 'var(--signal-dim)', minWidth: '148px' }}
                >
                  <span className="text-[11px] font-medium truncate" style={{ color: 'var(--t1)' }}>
                    {l.team} &middot; {l.role}
                  </span>
                </div>
              </div>
              <span className="mono-data text-xs w-10 text-right flex-shrink-0" style={{ color: 'var(--t2)' }}>
                {l.points.toFixed(1)}
              </span>
            </div>
          )
        })}
      </div>

      <p className="text-xs mt-5 leading-relaxed" style={{ color: 'var(--t3)' }}>
        Same player, three rosters. Rostiro sees him as one exposure line, not three separate surprises
        on Sunday.
      </p>
    </div>
  )
}
