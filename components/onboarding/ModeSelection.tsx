'use client'

import { useState } from 'react'
import { browserClient } from '@/lib/supabase-browser'

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
  // T-123: captured here (post-email-confirmation, since onboarding only
  // runs after that per the signup redirect) rather than on the signup
  // form itself — asking for a name before someone has even confirmed
  // their email adds friction to the step most likely to lose them.
  // Written to Supabase Auth's own user_metadata.full_name, which
  // app/api/pulse/sleeper/route.ts already reads for the Pulse greeting —
  // that plumbing existed, nothing was ever collecting the name for it.
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleContinue() {
    if (typeof window !== 'undefined') {
      localStorage.setItem('rostiro_mode', selected)
    }
    const trimmed = name.trim()
    if (trimmed) {
      setSaving(true)
      try {
        await browserClient.auth.updateUser({ data: { full_name: trimmed } })
      } catch {
        // Non-critical — the greeting just falls back to name-less phrasing
        // if this fails, never blocks onboarding on it.
      } finally {
        setSaving(false)
      }
    }
    onContinue(selected)
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: 'var(--void)' }}>
      <div className="flex-1 flex flex-col items-center justify-center px-4 py-12">
        <div className="w-full max-w-4xl">

          {/* Header */}
          <div className="text-center mb-10">
            <p className="text-xs font-semibold tracking-[0.2em] uppercase mb-4" style={{ color: 'var(--signal)' }}>
              ROSTIRO
            </p>
            <h1 className="text-3xl sm:text-4xl font-bold text-white mb-3 tracking-tight">
              How do you run your leagues?
            </h1>
            <p className="text-sm" style={{ color: 'var(--t2)' }}>
              This shapes every screen. You can change it anytime.
            </p>
          </div>

          {/* T-123: name capture — optional, single first-name field. Not
              gated on it; Continue works either way, the greeting just
              stays name-less if skipped. */}
          <div className="max-w-xs mx-auto mb-10">
            <label htmlFor="onboarding-name" className="block text-xs font-medium mb-2 text-center" style={{ color: 'var(--t2)' }}>
              What should we call you?
            </label>
            <input
              id="onboarding-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="First name"
              maxLength={40}
              className="w-full text-center text-sm rounded-xl px-4 py-2.5 focus:outline-none"
              style={{
                backgroundColor: 'rgba(8, 15, 26, 0.6)',
                border: '1.5px solid var(--hairline)',
                color: 'white',
              }}
            />
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
                    backgroundColor: isSelected ? 'var(--glass-solid)' : 'rgba(8, 15, 26, 0.6)',
                    border: `1.5px solid ${isSelected ? 'var(--signal)' : 'var(--hairline)'}`,
                    boxShadow: isSelected ? '0 0 0 1px var(--signal-dim), 0 4px 24px var(--signal-dim)' : 'none',
                  }}
                >
                  {/* Title row */}
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-white font-semibold text-base">{mode.label}</span>
                    <span
                      className="text-xs font-medium px-2 py-0.5 rounded-full"
                      style={{
                        backgroundColor: isSelected ? 'var(--signal-dim)' : 'var(--hairline)',
                        color: isSelected ? 'var(--signal)' : 'var(--t2)',
                        border: `1px solid ${isSelected ? 'rgba(75,163,245,.35)' : 'var(--hairline)'}`,
                      }}
                    >
                      {mode.badge}
                    </span>
                  </div>

                  {/* Tagline + description */}
                  <p className="text-sm font-medium mb-0.5" style={{ color: isSelected ? '#C8DCF0' : 'var(--t2)' }}>
                    {mode.tagline}
                  </p>
                  <p className="text-xs mb-4" style={{ color: 'var(--t2)' }}>
                    {mode.description}
                  </p>

                  {/* Live preview */}
                  <div
                    className="rounded-xl p-3 text-left"
                    style={{ backgroundColor: 'rgba(6, 11, 19, 0.55)', border: '1px solid var(--hairline)' }}
                  >
                    <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: 'rgba(75,163,245,.35)' }}>
                      preview
                    </p>
                    {mode.preview}
                  </div>

                  {/* Selected indicator */}
                  {isSelected && (
                    <div className="flex items-center gap-1.5 mt-3">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: 'var(--signal)' }} />
                      <span className="text-xs font-medium" style={{ color: 'var(--signal)' }}>Selected</span>
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
              disabled={saving}
              className="w-full sm:w-72 py-3.5 rounded-xl font-semibold text-sm text-white transition-all duration-200 hover:brightness-110 disabled:opacity-60"
              style={{ backgroundColor: 'var(--signal)' }}
            >
              {saving ? 'Saving…' : 'Continue →'}
            </button>
            <p className="text-xs" style={{ color: 'var(--t3)' }}>
              Free to start · Full Pro access when the season kicks off · No card required.
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
        <span className="text-xs mt-0.5" style={{ color: 'var(--crit)' }}>⚡</span>
        <div>
          <p className="text-xs font-semibold text-white">Mixon OUT · 2 leagues</p>
          <p className="text-xs" style={{ color: 'var(--t2)' }}>Zach Moss is the move.</p>
        </div>
      </div>
      <button
        className="text-xs font-semibold px-3 py-1 rounded-lg w-full text-center"
        style={{ backgroundColor: 'var(--signal-dim)', color: 'var(--signal)' }}
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
        <span className="text-xs mt-0.5" style={{ color: 'var(--crit)' }}>🚨</span>
        <div className="flex-1">
          <p className="text-xs font-semibold text-white">Joe Mixon — OUT</p>
          <p className="text-xs mb-1" style={{ color: 'var(--t2)' }}>Dynasty Kings, The League</p>
          <div className="flex items-center justify-between">
            <span className="text-xs" style={{ color: 'var(--t2)' }}>Pivot: Zach Moss</span>
            <span className="text-xs font-medium" style={{ color: 'var(--live)' }}>6.2 proj</span>
          </div>
          <p className="text-xs" style={{ color: 'var(--t2)' }}>vs LAR (32nd vs RBs)</p>
        </div>
      </div>
      <button
        className="text-xs font-semibold px-3 py-1 rounded-lg w-full text-center"
        style={{ backgroundColor: 'var(--signal-dim)', color: 'var(--signal)' }}
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
        <span className="text-xs" style={{ color: 'var(--crit)' }}>⚠</span>
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
            <span className="text-xs" style={{ color: 'var(--t2)' }}>{label}</span>
            <span className="text-xs font-medium" style={{ color: 'var(--t2)' }}>{val}</span>
          </div>
        ))}
      </div>
      <div className="flex gap-1.5 pt-0.5">
        <button
          className="text-xs px-2 py-0.5 rounded font-medium flex-1"
          style={{ backgroundColor: 'var(--signal-dim)', color: 'var(--signal)' }}
        >
          Activate
        </button>
        <button
          className="text-xs px-2 py-0.5 rounded font-medium flex-1"
          style={{ backgroundColor: 'var(--hairline)', color: 'var(--t2)' }}
        >
          Full report
        </button>
      </div>
    </div>
  )
}
