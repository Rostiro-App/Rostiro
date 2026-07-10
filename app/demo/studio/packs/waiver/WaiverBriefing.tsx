import type { WaiverContent } from './waiverPack'

const GREEN = '#1D9E75'

export function WaiverBriefing({ content }: { content: WaiverContent }) {
  return (
    <div className="max-w-2xl mx-auto px-5 md:px-6 pt-8 pb-10">
      <div className="mb-5">
        <span className="mono-data inline-block text-[9.5px] tracking-[0.16em] px-2 py-0.5 rounded-full mb-2"
          style={{ color: GREEN, border: `1px solid ${GREEN}`, backgroundColor: 'color-mix(in srgb, currentColor 12%, transparent)' }}>
          MISSION BRIEFING
        </span>
        <h1 className="text-[22px] font-semibold tracking-tight" style={{ color: 'var(--t1)' }}>Good morning, Lawrence.</h1>
        <p className="text-[13px] mt-0.5" style={{ color: 'var(--t2)' }}>
          <b style={{ color: GREEN, fontWeight: 600 }}>{content.targets.length} priority waiver {content.targets.length === 1 ? 'target' : 'targets'}</b>
          {' across 1 league'}
        </p>
      </div>
      <div className="space-y-3">
        {content.targets.map((t, i) => (
          <article key={i} className="glass card-hover relative rounded-xl px-4 py-3 pl-[18px]">
            <span aria-hidden="true" className="absolute left-0 top-2.5 bottom-2.5 w-[2.5px] rounded-full" style={{ backgroundColor: 'var(--live)', boxShadow: '0 0 10px rgba(67,192,119,.6)' }} />
            <div className="flex items-start justify-between gap-2.5">
              <div className="min-w-0">
                <p className="font-semibold leading-tight text-[13.5px]" style={{ color: 'var(--t1)' }}>{t.name}</p>
                <p className="mono-data text-[10px] mt-1" style={{ color: 'var(--t3)' }}>{t.pos.toUpperCase()} · {content.leagueName.toUpperCase()}</p>
              </div>
              <span className="mono-data text-[8.5px] tracking-[0.16em] px-1.5 py-0.5 rounded flex-shrink-0" style={{ color: 'var(--live)', backgroundColor: 'color-mix(in srgb, currentColor 12%, transparent)' }}>WAIVER</span>
            </div>
            <p className="text-[12.5px] mt-2 leading-normal" style={{ color: 'var(--t2)' }}>
              Adding in <b style={{ color: 'var(--t1)' }}>{t.addPct}%</b> of leagues. Suggested bid: <b style={{ color: 'var(--t1)' }}>${t.faabSuggestion}</b> of your $100 FAAB.
            </p>
          </article>
        ))}
      </div>
    </div>
  )
}
