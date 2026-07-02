'use client'

import { useState } from 'react'

type Mode = 'focused' | 'balanced' | 'savant'

const MODES = [
  {
    id: 'focused' as Mode,
    label: 'Focused',
    badge: 'Quick & clean',
    tagline: 'Just tell me what to do.',
    description: '2–3 leagues. Done in 3 minutes.',
    preview: <FocusedPreview />,
  },
  {
    id: 'balanced' as Mode,
    label: 'Balanced',
    badge: 'Recommended',
    tagline: 'Context + decisions.',
    description: 'The right data, without noise.',
    preview: <BalancedPreview />,
  },
  {
    id: 'savant' as Mode,
    label: 'Savant',
    badge: 'Data heavy',
    tagline: 'Show me everything.',
    description: 'Full layer. Every edge.',
    preview: <SavantPreview />,
  },
]

export default function ModeSelection({ onContinue }: { onContinue: (mode: Mode) => void }) {
  const [selected, setSelected] = useState<Mode>('balanced')

  function handleContinue() {
    if (typeof window !== 'undefined') {
      localStorage.setItem('rostiro_mode', selected)
    }
    onContinue(selected)
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: '#0D1B2A' }}>
      <div className="flex-1 flex flex-col items-center justify-center px-4 py-12">
        <div className="w-full max-w-4xl">

          {/* Header */}
          <div className="text-center mb-10">
            <p className="text-xs font-semibold tracking-[0.2em] uppercase mb-4" style={{ color: '#378ADD' }}>
              ROSTIRO
            </p>
            <h1 className="text-3xl sm:text-4xl font-bold text-white mb-3 tracking-tight">
              How do you run your leagues?
            </h1>
            <p className="text-sm" style={{ color: '#5A7A9A' }}>
              This shapes every screen. You can change it anytime.
            </p>
          </div>

          {/* Mode cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
            {MODES.map((mode) => {
              const isSelected = selected === mode.id
              return (
                <button
                  key={mode.id}
                  onClick={() => setSelected(mode.id)}
                  className="text-left rounded-2xl p-5 transition-all duration-200 focus:outline-none"
                  style={{
                    backgroundColor: isSelected ? '#0F2235' : '#0A1520',
                    border: `1.5px solid ${isSelected ? '#378ADD' : '#1A3048'}`,
                    boxShadow: isSelected ? '0 0 0 1px #378ADD22, 0 4px 24px #378ADD18' : 'none',
                  }}
                >
                  {/* Title row */}
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-white font-semibold text-base">{mode.label}</span>
                    <span
                      className="text-xs font-medium px-2 py-0.5 rounded-full"
                      style={{
                        backgroundColor: isSelected ? '#378ADD22' : '#1A3048',
                        color: isSelected ? '#378ADD' : '#5A7A9A',
                        border: `1px solid ${isSelected ? '#378ADD44' : '#1A3048'}`,
                      }}
                    >
                      {mode.badge}
                    </span>
                  </div>

                  {/* Tagline + description */}
                  <p className="text-sm font-medium mb-0.5" style={{ color: isSelected ? '#C8DCF0' : '#8AAABB' }}>
                    {mode.tagline}
                  </p>
                  <p className="text-xs mb-4" style={{ color: '#5A7A9A' }}>
                    {mode.description}
                  </p>

                  {/* Live preview */}
                  <div
                    className="rounded-xl p-3 text-left"
                    style={{ backgroundColor: '#07111C', border: '1px solid #1A3048' }}
                  >
                    <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: '#378ADD55' }}>
                      preview
                    </p>
                    {mode.preview}
                  </div>

                  {/* Selected indicator */}
                  {isSelected && (
                    <div className="flex items-center gap-1.5 mt-3">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: '#378ADD' }} />
                      <span className="text-xs font-medium" style={{ color: '#378ADD' }}>Selected</span>
                    </div>
                  )}
                </button>
              )
            })}
          </div>

          {/* CTA */}
          <div className="flex flex-col items-center gap-3">
            <button
              onClick={handleContinue}
              className="w-full sm:w-72 py-3.5 rounded-xl font-semibold text-sm text-white transition-all duration-200 hover:brightness-110"
              style={{ backgroundColor: '#378ADD' }}
            >
              Continue →
            </button>
            <p className="text-xs" style={{ color: '#3A5A7A' }}>
              Free for 7 days — no card required.
            </p>
          </div>

        </div>
      </div>
    </div>
  )
}

// ─── Pulse previews ─────────────────────────────────────────────────────────

function FocusedPreview() {
  return (
    <div className="space-y-2">
      <div className="flex items-start gap-2">
        <span className="text-xs mt-0.5" style={{ color: '#E84040' }}>⚡</span>
        <div>
          <p className="text-xs font-semibold text-white">Mixon OUT · 2 leagues</p>
          <p className="text-xs" style={{ color: '#5A7A9A' }}>Zach Moss is the move.</p>
        </div>
      </div>
      <button
        className="text-xs font-semibold px-3 py-1 rounded-lg w-full text-center"
        style={{ backgroundColor: '#378ADD22', color: '#378ADD' }}
      >
        Set lineups →
      </button>
    </div>
  )
}

function BalancedPreview() {
  return (
    <div className="space-y-2">
      <div className="flex items-start gap-2">
        <span className="text-xs mt-0.5" style={{ color: '#E84040' }}>🚨</span>
        <div className="flex-1">
          <p className="text-xs font-semibold text-white">Joe Mixon — OUT</p>
          <p className="text-xs mb-1" style={{ color: '#5A7A9A' }}>Dynasty Kings, The League</p>
          <div className="flex items-center justify-between">
            <span className="text-xs" style={{ color: '#8AAABB' }}>Pivot: Zach Moss</span>
            <span className="text-xs font-medium" style={{ color: '#4CAF72' }}>6.2 proj</span>
          </div>
          <p className="text-xs" style={{ color: '#5A7A9A' }}>vs LAR (32nd vs RBs)</p>
        </div>
      </div>
      <button
        className="text-xs font-semibold px-3 py-1 rounded-lg w-full text-center"
        style={{ backgroundColor: '#378ADD22', color: '#378ADD' }}
      >
        View options →
      </button>
    </div>
  )
}

function SavantPreview() {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1">
        <span className="text-xs" style={{ color: '#E84040' }}>⚠</span>
        <p className="text-xs font-semibold text-white">Mixon — OUT (hamstring)</p>
      </div>
      <div className="grid grid-cols-2 gap-x-3 gap-y-0.5">
        {[
          ['Snap share', '22%'],
          ['O/U', '45.5'],
          ['Moss proj', '14.2±3.1'],
          ['Floor', '63%'],
        ].map(([label, val]) => (
          <div key={label} className="flex justify-between">
            <span className="text-xs" style={{ color: '#5A7A9A' }}>{label}</span>
            <span className="text-xs font-medium" style={{ color: '#8AAABB' }}>{val}</span>
          </div>
        ))}
      </div>
      <div className="flex gap-1.5 pt-0.5">
        <button
          className="text-xs px-2 py-0.5 rounded font-medium flex-1"
          style={{ backgroundColor: '#378ADD22', color: '#378ADD' }}
        >
          Activate
        </button>
        <button
          className="text-xs px-2 py-0.5 rounded font-medium flex-1"
          style={{ backgroundColor: '#1A3048', color: '#8AAABB' }}
        >
          Full report
        </button>
      </div>
    </div>
  )
}
