export function DemoInterruptCard({ leaving, headline, reasoning }: { leaving?: boolean; headline: string; reasoning: string }) {
  const color = 'var(--signal)' // touchdown_swing → 'info' priority
  return (
    <div
      className={`glass-heavy absolute rounded-xl px-4 py-3 ${leaving ? 'card-leave' : 'panel-enter'}`}
      style={{
        top: '52px', left: '50%', transform: 'translateX(-50%)',
        width: 'min(360px, calc(100% - 24px))', zIndex: 40,
        borderLeft: `2.5px solid ${color}`,
        boxShadow: `0 12px 32px rgba(0,0,0,.35), 0 0 20px ${color}22`,
      }}
      role="status"
    >
      <div className="flex items-start justify-between gap-2">
        <span className="mono-data text-[9px] tracking-[0.16em]" style={{ color }}>TOUCHDOWN</span>
      </div>
      <p className="text-[13px] font-semibold mt-1" style={{ color: 'var(--t1)' }}>{headline}</p>
      <p className="text-[12px] mt-1 leading-snug" style={{ color: 'var(--t2)' }}>{reasoning}</p>
    </div>
  )
}
