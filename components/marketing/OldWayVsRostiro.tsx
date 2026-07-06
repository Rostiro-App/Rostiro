// Marketing hero visual for the homepage ProblemSection: makes the "four
// apps, none of them talking to each other" claim visible instead of only
// asserting it in the scenario text above. Right side reuses the same
// glass/mono-data primitives the real Pulse card renders with (see
// PulsePreviewCard in app/page.tsx), not a separate invented style.

const NOISY_APPS = [
  { name: 'ESPN', note: 'Diggs: questionable', rotate: -7, x: -95, y: -54 },
  { name: 'Yahoo', note: 'Waivers close 3pm', rotate: 5, x: 70, y: -30 },
  { name: 'Sleeper', note: '12 unread chat msgs', rotate: -4, x: -60, y: 42 },
  { name: 'Group text', note: '"did you see that?"', rotate: 6, x: 85, y: 56 },
]

export default function OldWayVsRostiro() {
  return (
    <div className="grid md:grid-cols-[1fr_auto_1fr] items-center gap-6 md:gap-4 mt-14 max-w-4xl mx-auto">
      <div className="relative h-[230px] flex items-center justify-center">
        {NOISY_APPS.map((app, i) => (
          <div
            key={app.name}
            className="absolute rounded-xl px-4 py-3 w-[176px]"
            style={{
              backgroundColor: 'var(--glass-solid)',
              border: '1px solid var(--hairline-bright)',
              transform: `translate(${app.x}px, ${app.y}px) rotate(${app.rotate}deg)`,
              zIndex: i,
              boxShadow: '0 8px 20px -8px rgba(0,0,0,0.6)',
            }}
          >
            <p className="mono-data text-[10px] tracking-[0.1em] uppercase font-bold" style={{ color: 'var(--t2)' }}>
              {app.name}
            </p>
            <p className="text-xs mt-1" style={{ color: 'var(--t3)' }}>{app.note}</p>
          </div>
        ))}
      </div>

      <svg width="40" height="24" viewBox="0 0 40 24" className="mx-auto rotate-90 md:rotate-0" aria-hidden="true">
        <line x1="0" y1="12" x2="30" y2="12" stroke="var(--signal)" strokeWidth="2" />
        <path d="M28 5 L38 12 L28 19" fill="none" stroke="var(--signal)" strokeWidth="2" />
      </svg>

      <div
        className="glass-heavy rounded-xl px-5 py-4"
        style={{ borderLeft: '2.5px solid var(--signal)', boxShadow: '0 12px 32px -12px rgba(0,0,0,0.5)' }}
      >
        <p className="mono-data text-[10px] tracking-[0.1em] uppercase" style={{ color: 'var(--signal)' }}>
          Pulse
        </p>
        <p className="text-sm font-semibold mt-1.5" style={{ color: 'var(--t1)' }}>
          Bench Diggs, 31mph winds at kickoff.
        </p>
        <p className="text-xs mt-1" style={{ color: 'var(--t3)' }}>
          One card. Every league. What actually matters.
        </p>
      </div>
    </div>
  )
}
