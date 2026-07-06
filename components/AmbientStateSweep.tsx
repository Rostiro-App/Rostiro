// Auth screens (login/signup) were flat var(--void) with zero texture —
// the only pages on the site with none of the ambient "the OS is alive"
// language everything else has. Founder's own idea: a slow wash cycling
// through all five real Rostiro States' colors (STATE_CONFIG), a literal
// answer to "the various states of the OS throughout the fantasy week"
// rather than a single static blue gradient.
//
// Deliberately calmer than the marketing hero's AmbientSignalField: no
// typing pills, no ticker vocabulary, no waveform — a task screen (typing
// a password) shouldn't compete for attention the way a selling moment
// can. Five blurred solid-color blobs stacked in the same position,
// crossfading through in sequence via staggered animation-delay (same
// technique as the hero's floating pills, just five-way and much slower —
// 80s for a full cycle vs. the hero's ~16-19s pill loops). Per the
// founder's decision, the login/signup card itself stays completely
// static; only this background layer moves.
//
// Pure CSS (globals.css's .state-sweep-blob), no client JS, respects
// prefers-reduced-motion (falls back to the original flat background).

import { STATE_CONFIG } from '@/lib/brandTokens'

const SWEEP_DURATION = '80s'
const STATES: Array<keyof typeof STATE_CONFIG> = ['draft', 'standard', 'waiver_day', 'game_day', 'film_room']

export default function AmbientStateSweep() {
  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none" aria-hidden="true" style={{ zIndex: 0 }}>
      {STATES.map((state, i) => (
        <div
          key={state}
          className="state-sweep-blob absolute"
          style={
            {
              top: '50%',
              left: '50%',
              width: '70vw',
              height: '70vw',
              transform: 'translate(-50%, -50%)',
              borderRadius: '50%',
              background: `radial-gradient(circle, ${STATE_CONFIG[state].color}33, transparent 65%)`,
              filter: 'blur(60px)',
              '--sweep-duration': SWEEP_DURATION,
              '--sweep-delay': `${(i * 80) / STATES.length}s`,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  )
}
