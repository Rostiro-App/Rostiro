'use client'

// The real "LIVE just opened" announcement — global, not page-scoped.
// This used to live inside app/(dashboard)/live/page.tsx, gated on that
// page's own justUnlocked transition. That never actually worked as an
// announcement: the LIVE nav item (BottomNav.tsx / Sidebar.tsx) renders as
// a plain, non-clickable dimmed span with no href at all until the window
// opens, so nobody arriving through normal navigation could ever be
// sitting on /live at the moment it unlocked to see it. Moved here and
// mounted once in AppShell (same pattern as BootSequence/InterruptStack)
// so it fires from wherever the user actually is — Pulse, Leagues,
// anywhere — which is the whole point of an announcement.
//
// Tap-to-dismiss, gated by the same once-per-ET-day localStorage key
// useLiveUnlockTransition already owns, and skippable via the Settings
// "big animations" toggle, same as every other full-screen takeover.

import { useState } from 'react'
import { useLiveUnlocked } from '@/lib/useLiveUnlocked'
import { useLiveUnlockTransition } from '@/lib/useLiveUnlockTransition'
import { bigAnimationsEnabled } from '@/lib/animationPrefs'

export default function LiveUnlockAnnouncement() {
  const liveUnlocked = useLiveUnlocked()
  const justUnlocked = useLiveUnlockTransition(liveUnlocked)
  const [dismissed, setDismissed] = useState(false)

  if (!justUnlocked || dismissed || !bigAnimationsEnabled()) return null

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center panel-enter"
      style={{ background: 'radial-gradient(circle at 50% 42%, rgba(226,75,74,.18), rgba(5,9,16,.96) 70%)' }}
      onClick={() => setDismissed(true)}
    >
      <span className="w-3 h-3 rounded-full breathe" style={{ backgroundColor: '#E24B4A', boxShadow: '0 0 40px rgba(226,75,74,.8)' }} />
      <p className="mono-data text-3xl font-extrabold tracking-[0.3em] mt-6" style={{ color: '#E24B4A', textShadow: '0 0 40px rgba(226,75,74,.55)' }}>
        LIVE IS OPEN
      </p>
      <p className="text-sm mt-3" style={{ color: 'var(--t2)' }}>
        Your players are taking the field.
      </p>
    </div>
  )
}
