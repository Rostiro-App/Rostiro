import type { FilmContent } from './filmPack'
const input = { width: '100%', background: 'rgba(8,15,26,.6)', border: '1px solid var(--hairline)', borderRadius: 8, padding: '6px 8px', color: 'var(--t1)', fontSize: 13 } as const
const lbl = { display: 'block', fontSize: 11, color: 'var(--t3)', marginBottom: 4 } as const

export function FilmAuthorForm({ content, onChange }: { content: FilmContent; onChange: (c: FilmContent) => void }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div><label className="mono-data" style={lbl}>League</label>
        <input style={input} value={content.leagueName} onChange={(e) => onChange({ ...content, leagueName: e.target.value })} /></div>
      <div style={{ display: 'flex', gap: 10 }}>
        <div style={{ flex: 1 }}><label className="mono-data" style={lbl}>Result</label>
          <select style={input} value={content.won === null ? 'even' : content.won ? 'won' : 'lost'}
            onChange={(e) => onChange({ ...content, won: e.target.value === 'even' ? null : e.target.value === 'won' })}>
            <option value="won">Won</option><option value="lost">Lost</option><option value="even">Even</option>
          </select></div>
        <div style={{ width: 80 }}><label className="mono-data" style={lbl}>My score</label>
          <input style={input} type="number" step="0.1" value={content.myScore} onChange={(e) => onChange({ ...content, myScore: Number(e.target.value) })} /></div>
        <div style={{ width: 80 }}><label className="mono-data" style={lbl}>Opp score</label>
          <input style={input} type="number" step="0.1" value={content.oppScore} onChange={(e) => onChange({ ...content, oppScore: Number(e.target.value) })} /></div>
      </div>
      <div><label className="mono-data" style={lbl}>Recap</label>
        <input style={input} value={content.recap} onChange={(e) => onChange({ ...content, recap: e.target.value })} /></div>
      {content.usage && (
        <div style={{ display: 'flex', gap: 6 }}>
          <input style={{ ...input, flex: 2 }} value={content.usage.name} onChange={(e) => onChange({ ...content, usage: { ...content.usage!, name: e.target.value } })} />
          <select style={{ ...input, width: 100 }} value={content.usage.direction} onChange={(e) => onChange({ ...content, usage: { ...content.usage!, direction: e.target.value as 'buy_low' | 'sell_high' } })}>
            <option value="buy_low">Buy low</option><option value="sell_high">Sell high</option>
          </select>
          <input style={{ ...input, width: 60 }} type="number" value={content.usage.deltaPct} onChange={(e) => onChange({ ...content, usage: { ...content.usage!, deltaPct: Number(e.target.value) } })} />
        </div>
      )}
    </div>
  )
}
