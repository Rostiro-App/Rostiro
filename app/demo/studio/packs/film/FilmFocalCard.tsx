import type { FilmContent } from './filmPack'
const PURPLE = '#7F77DD'
export function FilmFocalCard({ content }: { content: FilmContent }) {
  const line = content.won === true ? 'YOU WON' : content.won === false ? 'TOUGH LOSS' : 'EVEN SPLIT'
  return (
    <div className="glass-heavy rounded-2xl px-6 py-5 mx-auto" style={{ width: 'min(380px, calc(100% - 32px))', borderLeft: `3px solid ${PURPLE}` }}>
      <div className="mono-data text-[10px] tracking-[0.18em]" style={{ color: PURPLE }}>{line} · {content.leagueName.toUpperCase()}</div>
      <div className="text-[26px] font-bold mt-1" style={{ color: 'var(--t1)' }}>{content.myScore.toFixed(1)} – {content.oppScore.toFixed(1)}</div>
      {content.usage && <div className="mono-data text-[13px] mt-3" style={{ color: 'var(--t2)' }}>{content.usage.direction === 'buy_low' ? '↑ Buy low' : '↓ Sell high'}: {content.usage.name}</div>}
    </div>
  )
}
