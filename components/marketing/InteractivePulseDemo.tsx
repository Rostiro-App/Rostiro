'use client'

// Features page, Pillar 1: a real interactive demo, not a static screenshot.
// Reuses the exact same three-mode density model the product itself ships
// (PRD §3), against one fixed decision, so a visitor feels "data density as
// identity" by clicking instead of reading it as a claim. No auth, no fetch.
// The underlying decision is fixed sample data, the same one row of
// content just rendered three different ways.

import { useState } from 'react'

type DemoMode = 'focused' | 'balanced' | 'savant'

const MODES: { key: DemoMode; label: string; tagline: string }[] = [
  { key: 'focused', label: 'Focused', tagline: 'Tell me what to do' },
  { key: 'balanced', label: 'Balanced', tagline: 'Show me the key stuff' },
  { key: 'savant', label: 'Savant', tagline: 'Give me everything' },
]

export default function InteractivePulseDemo() {
  const [mode, setMode] = useState<DemoMode>('balanced')

  return (
    <div className="max-w-xl mx-auto">
      <div className="flex justify-center gap-2 mb-5">
        {MODES.map((m) => (
          <button
            key={m.key}
            type="button"
            onClick={() => setMode(m.key)}
            className="mono-data text-[10.5px] font-semibold tracking-[0.08em] px-3 py-1.5 rounded-full transition-all"
            style={
              mode === m.key
                ? { color: 'var(--signal)', border: '1px solid rgba(75,163,245,.4)', backgroundColor: 'var(--signal-dim)' }
                : { color: 'var(--t3)', border: '1px solid var(--hairline)' }
            }
          >
            {m.label}
          </button>
        ))}
      </div>

      <div
        className="glass-heavy rounded-2xl overflow-hidden"
        style={{ boxShadow: '0 20px 60px -20px rgba(0,0,0,0.6)' }}
      >
        <div className="flex items-center justify-between px-5 py-3" style={{ borderBottom: '1px solid var(--hairline)' }}>
          <span className="mono-data text-[10px] tracking-[0.1em]" style={{ color: 'var(--t3)' }}>
            {MODES.find((m) => m.key === mode)?.tagline}
          </span>
          <span
            className="mono-data text-[10px] font-bold tracking-[0.12em] px-2 py-0.5 rounded"
            style={{ backgroundColor: 'var(--signal-dim)', color: 'var(--signal)' }}
          >
            WAIVER
          </span>
        </div>

        <div className="px-5 py-4">
          <p className="text-sm font-semibold" style={{ color: 'var(--t1)' }}>
            Claim Jaylen Warren
          </p>

          {mode === 'focused' && (
            <p className="text-xs mt-1.5" style={{ color: 'var(--t3)' }}>
              Cutoff today, 3:00 PM. One tap to claim.
            </p>
          )}

          {mode === 'balanced' && (
            <>
              <p className="text-sm mt-2 leading-relaxed" style={{ color: 'var(--t2)' }}>
                Bench role expanded to lead back after Sunday&apos;s usage shift. Cutoff today, 3:00 PM,
                Yahoo League 2.
              </p>
              <div className="flex gap-4 mt-3">
                <span className="mono-data text-[11px]" style={{ color: 'var(--t3)' }}>SNAPS <b style={{ color: 'var(--t1)' }}>71%</b></span>
                <span className="mono-data text-[11px]" style={{ color: 'var(--t3)' }}>ADP <b style={{ color: 'var(--t1)' }}>42</b></span>
              </div>
            </>
          )}

          {mode === 'savant' && (
            <>
              <p className="text-sm mt-2 leading-relaxed" style={{ color: 'var(--t2)' }}>
                Bench role expanded to lead back after Sunday&apos;s usage shift. Cutoff today, 3:00 PM,
                Yahoo League 2. Advisory only, the call is yours.
              </p>
              <div className="grid grid-cols-4 gap-3 mt-3">
                {[
                  ['SNAPS', '71%'],
                  ['ADP', '42'],
                  ['TARGET SH.', '18%'],
                  ['FAAB EST.', '$14'],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-lg px-2.5 py-2" style={{ border: '1px solid var(--hairline)' }}>
                    <p className="mono-data text-[9px] tracking-wide" style={{ color: 'var(--t4)' }}>{label}</p>
                    <p className="mono-data text-sm font-bold mt-0.5" style={{ color: 'var(--t1)' }}>{value}</p>
                  </div>
                ))}
              </div>
            </>
          )}

          <div className="flex items-center gap-2 mt-4">
            <span
              className="mono-data text-[10.5px] font-semibold px-3 py-1.5 rounded-lg"
              style={{ color: 'var(--live)', border: '1px solid rgba(67,192,119,.35)' }}
            >
              Claim on Yahoo →
            </span>
            {mode !== 'focused' && (
              <span className="mono-data text-[10.5px] px-3 py-1.5 rounded-lg" style={{ color: 'var(--t3)', border: '1px solid var(--hairline)' }}>
                Snooze
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
