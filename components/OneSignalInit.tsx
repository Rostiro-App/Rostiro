'use client'

// OneSignal Web SDK init (PRD 6.6). Mounted once in the root layout. Pushes
// an init call onto window.OneSignalDeferred (queued by the CDN script tag
// in app/layout.tsx, which may still be loading when this runs — that's the
// whole point of the deferred-push pattern), then reports the subscription
// id to /api/push/subscribe whenever it's available or changes.
//
// This is the SDK wiring only — the guided permission-prompt UI (onboarding
// Step 5, with the iOS "Add to Home Screen" copy) is a separate, still-
// parked piece per PRD 6.8/Section 4. This component doesn't prompt for
// permission itself; OneSignal's default browser prompt behavior applies
// until Step 5 replaces it with the designed one.

import { useEffect } from 'react'

interface OneSignalPushSubscription {
  id: string | null | undefined
  addEventListener: (event: 'change', cb: (e: { current: { id?: string } }) => void) => void
}

interface OneSignalSdk {
  init: (options: { appId: string; allowLocalhostAsSecureOrigin?: boolean }) => Promise<void>
  User: { PushSubscription: OneSignalPushSubscription }
}

declare global {
  interface Window {
    OneSignalDeferred?: Array<(sdk: OneSignalSdk) => void>
  }
}

async function reportSubscriptionId(subscriptionId: string) {
  try {
    await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subscriptionId }),
    })
  } catch {
    // Best-effort — a failed report here just means the next page load
    // (or the next subscription change event) tries again.
  }
}

export default function OneSignalInit() {
  useEffect(() => {
    const appId = process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID
    if (!appId) return

    window.OneSignalDeferred = window.OneSignalDeferred ?? []
    window.OneSignalDeferred.push(async (OneSignal) => {
      await OneSignal.init({
        appId,
        allowLocalhostAsSecureOrigin: process.env.NODE_ENV !== 'production',
      })

      const existingId = OneSignal.User.PushSubscription.id
      if (existingId) reportSubscriptionId(existingId)

      OneSignal.User.PushSubscription.addEventListener('change', (event) => {
        if (event.current.id) reportSubscriptionId(event.current.id)
      })
    })
  }, [])

  return null
}
