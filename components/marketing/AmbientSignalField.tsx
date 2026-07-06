// T-124 revision ("Living Signal Field"): homepage hero ambient background.
// Two deliberately abstract layers, nothing legible — founder flagged a
// literal ticker (real player names/stats) as intimidating to a first-time
// casual visitor, the exact audience the hero has to not scare off.
//
// Layer 1: oversized, heavily blurred pulse-waveform strips (the same
// heartbeat envelope shape as components/PulseMark.tsx, scaled way up),
// drifting slowly — the "Bloomberg line-chart" and "the system is alive"
// feeling, expressed as pure motion, never as data to read.
// Layer 2: a handful of sparse floating single-word tag pills, using the
// real product's own Pulse card vocabulary (TYPE_CONFIG's labels in
// app/(dashboard)/pulse/page.tsx) so it's honest foreshadowing rather than
// invented decoration — but only ever 2-3 visible at once, fading in and
// out on staggered cycles, never a dense scrolling row.
//
// No JS, no client component needed — everything here is static markup
// driven entirely by CSS animations (globals.css's .signal-wave /
// .tag-pill-float), so it renders once on the server with zero hydration
// cost and respects prefers-reduced-motion for free via the same block
// every other ambient animation on the site already uses.

const WAVE_PATH =
  'M0,100 L120,100 L150,60 L180,140 L210,20 L240,160 L270,100 L420,100 ' +
  'L450,60 L480,140 L510,20 L540,160 L570,100 L720,100 ' +
  'L750,60 L780,140 L810,20 L840,160 L870,100 L1020,100 ' +
  'L1050,60 L1080,140 L1110,20 L1140,160 L1170,100 L1400,100'

const TAG_PILLS = [
  { label: 'WAIVER', color: 'var(--live)', top: '12%', left: '8%', duration: '17s', delay: '0s' },
  { label: 'TOUCHDOWN', color: 'var(--live)', top: '68%', left: '82%', duration: '19s', delay: '4s' },
  { label: 'TRADE', color: 'var(--signal)', top: '78%', left: '14%', duration: '15s', delay: '8s' },
  { label: 'INJURY', color: 'var(--crit)', top: '20%', left: '86%', duration: '18s', delay: '11s' },
  { label: 'REVIEW', color: 'var(--signal)', top: '45%', left: '90%', duration: '16s', delay: '2s' },
]

export default function AmbientSignalField({ accent }: { accent: string }) {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true" style={{ zIndex: 0 }}>
      {/* Layer 1: waveform strips */}
      <svg
        className="signal-wave absolute"
        style={{ top: '8%', left: '-10%', width: '120%', height: 140, filter: 'blur(10px)', opacity: 0.4, '--wave-duration': '38s' } as React.CSSProperties}
        viewBox="0 0 1400 200"
        preserveAspectRatio="none"
      >
        <path d={WAVE_PATH} fill="none" stroke={accent} strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <svg
        className="signal-wave absolute"
        style={{ top: '55%', left: '-10%', width: '120%', height: 100, filter: 'blur(14px)', opacity: 0.26, '--wave-duration': '52s' } as React.CSSProperties}
        viewBox="0 0 1400 200"
        preserveAspectRatio="none"
      >
        <path d={WAVE_PATH} fill="none" stroke={accent} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>

      {/* Layer 2: sparse floating tag pills — real product vocabulary,
          never more than a couple visible at once. */}
      {TAG_PILLS.map((p) => (
        <span
          key={p.label}
          className="tag-pill-float mono-data absolute text-[11px] tracking-[0.14em] px-3 py-1 rounded-full"
          style={
            {
              top: p.top,
              left: p.left,
              color: p.color,
              border: `1px solid ${p.color}`,
              backgroundColor: 'rgba(8,15,26,0.4)',
              '--pill-duration': p.duration,
              '--pill-delay': p.delay,
            } as React.CSSProperties
          }
        >
          {p.label}
        </span>
      ))}
    </div>
  )
}
