// T-124 revision ("Living Signal Field"): homepage hero ambient background.
// Two deliberately abstract-ish layers:
//
// Layer 1: oversized, heavily blurred pulse-waveform strips (the same
// heartbeat envelope shape as components/PulseMark.tsx, scaled way up),
// drifting slowly — the "Bloomberg line-chart, the system is alive"
// feeling, expressed as pure motion.
//
// Layer 2, second revision: modeled directly on keyboardkarate.io's own
// hero (the founder's other product) — glass pills that type themselves
// out character-by-character with a blinking cursor, not static text.
// Content is short, real product moments (Pulse, Co-Pilot Signal, Waiver
// Day, Game Day, Film Room), each colored by that feature/state's real
// accent from STATE_CONFIG, so it's honest foreshadowing rather than
// invented decoration. Kept deliberately sparser and shorter-line than
// keyboardkarate's denser 2-3 line pills — founder's explicit concern is
// not overwhelming a first-time casual visitor with anything that reads
// as stats to parse, so these are short phrases, never numbers-heavy.
//
// No client JS: the typewriter reveal is pure CSS (an overflow-hidden
// span animating width in `ch` units with steps(N), globals.css's
// .type-reveal-text), so this renders once on the server with zero
// hydration cost and respects prefers-reduced-motion for free.

import { STATE_CONFIG } from '@/lib/brandTokens'

const WAVE_PATH =
  'M0,100 L120,100 L150,60 L180,140 L210,20 L240,160 L270,100 L420,100 ' +
  'L450,60 L480,140 L510,20 L540,160 L570,100 L720,100 ' +
  'L750,60 L780,140 L810,20 L840,160 L870,100 L1020,100 ' +
  'L1050,60 L1080,140 L1110,20 L1140,160 L1170,100 L1400,100'

const SIGNAL_PILLS = [
  { text: 'Bench Diggs, 2 leagues', color: STATE_CONFIG.standard.color, top: '10%', left: '6%', duration: '17s', delay: '0s' },
  { text: 'Co-Pilot: value pick available', color: STATE_CONFIG.draft.color, top: '70%', left: '78%', duration: '19s', delay: '5s' },
  { text: 'Claim Warren, cutoff 3PM', color: STATE_CONFIG.waiver_day.color, top: '76%', left: '10%', duration: '15s', delay: '9s' },
  { text: 'BUF 14–KC 10, Allen live', color: STATE_CONFIG.game_day.color, top: '16%', left: '82%', duration: '18s', delay: '3s' },
  { text: 'Week 3 recap: buy-low signal', color: STATE_CONFIG.film_room.color, top: '46%', left: '88%', duration: '16s', delay: '12s' },
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

      {/* Layer 2: sparse floating "typing" pills — keyboardkarate.io-style,
          real product vocabulary, never more than 2-3 visible at once. */}
      {SIGNAL_PILLS.map((p) => (
        <span
          key={p.text}
          className="tag-pill-float mono-data absolute text-[12px] px-3 py-1.5 rounded-lg"
          style={
            {
              top: p.top,
              left: p.left,
              color: p.color,
              border: `1px solid ${p.color}66`,
              backgroundColor: 'rgba(8,15,26,0.55)',
              '--pill-duration': p.duration,
              '--pill-delay': p.delay,
            } as React.CSSProperties
          }
        >
          {'✓ '}
          <span
            className="type-reveal-text"
            style={{ '--type-width': `${p.text.length}ch`, '--type-steps': p.text.length } as React.CSSProperties}
          >
            {p.text}
          </span>
          <span className="type-cursor">|</span>
        </span>
      ))}
    </div>
  )
}
