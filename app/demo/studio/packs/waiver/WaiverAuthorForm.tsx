import type { WaiverContent } from './waiverPack'

const input = { width: '100%', background: 'rgba(8,15,26,.6)', border: '1px solid var(--hairline)', borderRadius: 8, padding: '6px 8px', color: 'var(--t1)', fontSize: 13 } as const

export function WaiverAuthorForm({ content, onChange }: { content: WaiverContent; onChange: (c: WaiverContent) => void }) {
  const setTarget = (i: number, patch: Partial<WaiverContent['targets'][number]>) =>
    onChange({ ...content, targets: content.targets.map((t, j) => (j === i ? { ...t, ...patch } : t)) })
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div>
        <label className="mono-data" style={{ display: 'block', fontSize: 11, color: 'var(--t3)', marginBottom: 4 }}>League</label>
        <input style={input} value={content.leagueName} onChange={(e) => onChange({ ...content, leagueName: e.target.value })} />
      </div>
      <label className="mono-data" style={{ fontSize: 11, color: 'var(--t3)' }}>Waiver targets (editable)</label>
      {content.targets.map((t, i) => (
        <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <input style={{ ...input, flex: 2 }} value={t.name} onChange={(e) => setTarget(i, { name: e.target.value })} />
          <input style={{ ...input, width: 54 }} value={t.pos} onChange={(e) => setTarget(i, { pos: e.target.value })} />
          <input style={{ ...input, width: 60 }} type="number" value={t.addPct} onChange={(e) => setTarget(i, { addPct: Number(e.target.value) })} />
          <input style={{ ...input, width: 60 }} type="number" value={t.faabSuggestion} onChange={(e) => setTarget(i, { faabSuggestion: Number(e.target.value) })} />
          <button aria-label="Remove" onClick={() => onChange({ ...content, targets: content.targets.filter((_, j) => j !== i) })} style={{ color: 'var(--t3)' }}>✕</button>
        </div>
      ))}
      <button className="mono-data" style={{ fontSize: 11, color: 'var(--signal)', textAlign: 'left' }}
        onClick={() => onChange({ ...content, targets: [...content.targets, { name: 'New Player', pos: 'RB', addPct: 40, faabSuggestion: 15 }] })}>+ Add target</button>
    </div>
  )
}
