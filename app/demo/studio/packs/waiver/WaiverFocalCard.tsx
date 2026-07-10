import type { WaiverContent } from './waiverPack'

export function WaiverFocalCard({ content }: { content: WaiverContent }) {
  const t = content.targets[0]
  if (!t) return null
  return (
    <div className="glass-heavy rounded-2xl px-6 py-5 mx-auto" style={{ width: 'min(380px, calc(100% - 32px))', borderLeft: '3px solid var(--live)' }}>
      <div className="mono-data text-[10px] tracking-[0.18em]" style={{ color: 'var(--live)' }}>TOP WAIVER TARGET</div>
      <div className="text-[22px] font-bold mt-1" style={{ color: 'var(--t1)' }}>{t.name}</div>
      <div className="mono-data text-[12px]" style={{ color: 'var(--t3)' }}>{t.pos.toUpperCase()}</div>
      <div className="mono-data text-[15px] mt-3" style={{ color: 'var(--t1)' }}>▲ {t.addPct}% adding · bid ${t.faabSuggestion}</div>
    </div>
  )
}
