'use client'

// T-131: founder-reported concern — the sign-out control sits right next
// to Settings/Profile in the desktop dock and inside a dense mobile sheet,
// close enough to other controls that a misclick could sign someone out
// unintentionally. One shared confirm modal, used everywhere sign-out is
// triggered (Sidebar's dock icon, BottomNav's More sheet, Profile page's
// explicit Log Out button) so the behavior — and the copy — can't drift
// out of sync between the three.

import { useState } from 'react'
import { createPortal } from 'react-dom'
import { unregisterCurrentDeviceForLogout } from '@/lib/pushSubscription'

export default function LogoutConfirm({
  trigger,
}: {
  /** Render-prop so each call site keeps its own exact button styling
      (icon-only in the dock, full-width on Profile, a text row in the
      mobile sheet) — this component only owns the confirm step. */
  trigger: (open: () => void) => React.ReactNode
}) {
  const [confirming, setConfirming] = useState(false)

  // P3.5-4C correction: close the push logout lifecycle — remove THIS browser's
  // subscription association before the session is destroyed, so a shared
  // browser doesn't leave one user's device registered under the next signed-in
  // user. Best-effort and time-bounded: sign-out must proceed regardless, and
  // the server route only ever removes this device (other devices are kept).
  async function handleLogout(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    try {
      await Promise.race([
        unregisterCurrentDeviceForLogout(),
        new Promise((resolve) => setTimeout(resolve, 1500)),
      ])
    } catch {
      // Never block sign-out on push cleanup.
    }
    // Native submit bypasses this handler, preserving the server route's 303
    // Post/Redirect/Get behavior exactly.
    form.submit()
  }

  return (
    <>
      {trigger(() => setConfirming(true))}

      {confirming &&
        createPortal(
          // T-134: rendering this inline (a child of Sidebar's <aside>,
          // which sets backdropFilter directly) meant "fixed, cover the
          // whole viewport" was actually being contained by that <aside>'s
          // own box — filter/backdrop-filter establish a new containing
          // block for fixed-position descendants, same root cause as the
          // Pulse detail drawer's earlier z-index bug (see that fix's own
          // comment). Portaling to document.body escapes every ancestor's
          // filter/transform/stacking context entirely, the same fix
          // already established there.
          <div
            className="fixed inset-0 z-50 flex items-center justify-center px-4"
            style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
            onClick={() => setConfirming(false)}
          >
            <div
              className="rounded-xl p-6 max-w-sm w-full"
              style={{ backgroundColor: 'var(--glass-solid)', border: '1px solid var(--hairline)' }}
              onClick={(e) => e.stopPropagation()}
            >
              <p className="text-base font-semibold" style={{ color: 'var(--t1)' }}>
                Log out of Rostiro?
              </p>
              <p className="text-sm mt-1.5" style={{ color: 'var(--t2)' }}>
                You&apos;ll need to sign back in to see your leagues and Pulse.
              </p>
              <div className="flex gap-2 mt-5">
                <button
                  type="button"
                  onClick={() => setConfirming(false)}
                  className="flex-1 py-2.5 rounded-lg text-sm font-medium transition-all"
                  style={{ border: '1px solid var(--hairline)', color: 'var(--t2)' }}
                >
                  Cancel
                </button>
                <form action="/api/auth/signout" method="POST" onSubmit={handleLogout} className="flex-1">
                  <button
                    type="submit"
                    className="w-full py-2.5 rounded-lg text-sm font-semibold transition-all hover:brightness-110"
                    style={{ backgroundColor: 'rgba(226,75,74,0.14)', border: '1px solid rgba(226,75,74,.35)', color: '#E8504A' }}
                  >
                    Log out
                  </button>
                </form>
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  )
}
