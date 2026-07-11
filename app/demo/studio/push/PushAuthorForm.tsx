'use client'
import type { PushMoment } from '@/app/demo/lib/pushMoment'
import { prefillPushMoment } from '@/app/demo/lib/pushMoment'

const input = { width: '100%', background: 'rgba(8,15,26,.6)', border: '1px solid var(--hairline)', borderRadius: 8, padding: '6px 8px', color: 'var(--t1)', fontSize: 13 } as const
const label = { display: 'block', fontSize: 12, color: 'var(--t3)', marginBottom: 4 } as const

export function PushAuthorForm({ content, onChange }: { content: PushMoment; onChange: (c: PushMoment) => void }) {
  function set<K extends keyof PushMoment>(key: K, value: PushMoment[K]) {
    onChange({ ...content, [key]: value })
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <button onClick={() => onChange(prefillPushMoment())} className="mono-data" style={{ fontSize: 11, color: 'var(--signal)', textAlign: 'left' }}>↻ Reset to real-data prefill</button>

      <div><label className="mono-data" style={label}>Title</label>
        <input style={input} value={content.title} onChange={(e) => set('title', e.target.value)} /></div>
      <div><label className="mono-data" style={label}>Body (the &quot;why you got this&quot; line)</label>
        <textarea style={{ ...input, minHeight: 56, resize: 'vertical' }} value={content.body} onChange={(e) => set('body', e.target.value)} /></div>

      <div style={{ display: 'flex', gap: 10 }}>
        <div style={{ flex: 1 }}><label className="mono-data" style={label}>App name</label>
          <input style={input} value={content.appName} onChange={(e) => set('appName', e.target.value)} /></div>
        <div style={{ width: 90 }}><label className="mono-data" style={label}>Time</label>
          <input style={input} value={content.timeLabel} onChange={(e) => set('timeLabel', e.target.value)} /></div>
      </div>

      <div style={{ display: 'flex', gap: 10 }}>
        <div style={{ width: 90 }}><label className="mono-data" style={label}>Clock</label>
          <input style={input} value={content.clockTime} onChange={(e) => set('clockTime', e.target.value)} /></div>
        <div style={{ flex: 1 }}><label className="mono-data" style={label}>Date</label>
          <input style={input} value={content.dateLabel} onChange={(e) => set('dateLabel', e.target.value)} /></div>
      </div>
    </div>
  )
}
