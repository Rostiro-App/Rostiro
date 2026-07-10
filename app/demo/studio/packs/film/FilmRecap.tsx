import type { FilmContent } from './filmPack'

const PURPLE = '#7F77DD'

export function FilmRecap({ content }: { content: FilmContent }) {
  const resultLine = content.won === true ? 'You won this week' : content.won === false ? 'Not your week' : 'Even split'
  return (
    <div className="max-w-2xl mx-auto px-5 md:px-6 pt-8 pb-10">
      <span className="mono-data inline-block text-[9.5px] tracking-[0.16em] px-2 py-0.5 rounded-full mb-3" style={{ color: PURPLE, border: `1px solid ${PURPLE}` }}>FILM ROOM</span>
      <div className="rounded-xl px-4 py-3" style={{ backgroundColor: 'rgba(8, 15, 26, 0.6)', border: '1px solid var(--hairline)', borderLeft: `2.5px solid ${PURPLE}` }}>
        <p className="text-[12.5px]" style={{ color: 'var(--t1)' }}>{resultLine} — {content.leagueName}</p>
        <p className="mono-data text-[11px] mt-0.5" style={{ color: 'var(--t2)' }}>{content.myScore.toFixed(1)} – {content.oppScore.toFixed(1)}</p>
        {content.recap && <p className="text-[12px] mt-1.5 leading-relaxed" style={{ color: 'var(--t2)' }}>{content.recap}</p>}
        {content.usage && (
          <p className="mono-data text-[10.5px] mt-1.5" style={{ color: 'var(--t3)' }}>
            {content.usage.direction === 'buy_low' ? '↑' : '↓'} {content.usage.name} ({content.usage.position}) — snap share {content.usage.direction === 'buy_low' ? 'up' : 'down'} {content.usage.deltaPct}pts
          </p>
        )}
      </div>
    </div>
  )
}
