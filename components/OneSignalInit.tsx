'use client'

// OneSignal Web SDK init (PRD 6.6). Mounted once in the root layout. Pushes
// an init call onto window.OneSignalDeferred (queued by the CDN script tag
// in app/layout.tsx, which may still be loading when this runs — that's the
// whole point of the deferred-push pattern), then reports the subscription
// id to /api/push/subscribe whenever it's available or changes.
//
// This is the SDK wiring only — the guided permission-prompt UI (onboarding
// Step 5, with the iOS "Add to Home Screen" copy) is a separate, still-
// parked piece per PRD 6.8/Section 4.
//
// Rostiro does NOT automatically prompt for notification permission during
// initialization: init() below passes promptOptions with autoPrompt: false,
// so OneSignal never shows its own prompt on page load. Permission will be
// requested later, only through an explicit user action, in the designed
// onboarding/settings flow (Step 5). As defense in depth, the OneSignal
// dashboard's auto-prompt configuration must also remain disabled
// (Settings → Push & In-App → Web Settings → Permission Prompt Setup).

import { useEffect } from 'react'

interface OneSignalPushSubscription {
  id: string | null | undefined
  addEventListener: (event: 'change', cb: (e: { current: { id?: string } }) => void) => void
}

// Narrow slice of OneSignal's init options — only the fields Rostiro sets.
// promptOptions is included specifically to pin autoPrompt: false so the SDK
// never shows its own permission prompt on page load.
interface OneSignalInitOptions {
  appId: string
  allowLocalhostAsSecureOrigin?: boolean
  promptOptions?: {
    slidedown?: {
      prompts?: Array<{ type: 'push'; autoPrompt: boolean }>
    }
  }
}

interface OneSignalSdk {
  init: (options: OneSignalInitOptions) => Promise<void>
  User: { PushSubscription: OneSignalPushSubscription }
}

declare global {
  interface Window {
    OneSignalDeferred?: Array<(sdk: OneSignalSdk) => void>
    // P3.5-4A: per-page-lifecycle guard so a remount / React Strict Mode's
    // double-invoked effect can't queue a second init (window-scoped, so it
    // survives remounts within the same document and resets on a real reload).
    __rostiroPushInitStarted?: boolean
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
    // Missing config: exit quietly and honestly — no queue, no error.
    const appId = process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID
    if (!appId) return
    // At most once per page lifecycle (guards remounts / Strict Mode's
    // double-invoked effect from queuing a second init).
    if (window.__rostiroPushInitStarted) return
    window.__rostiroPushInitStarted = true

    window.OneSignalDeferred = window.OneSignalDeferred ?? []
    window.OneSignalDeferred.push(async (OneSignal) => {
      // P3.5-4A: the whole callback is wrapped — a slow, blocked, or failed
      // OneSignal.init() (the historical "SDK timeout") previously rejected
      // here with no catch, and since the SDK invokes this callback without
      // awaiting it, that surfaced as an UNHANDLED promise rejection in the
      // console. Push is strictly optional and must never do that or block the
      // app, so we catch, log once honestly (a warn, not silent suppression),
      // and continue. Rostiro, Pulse, auth, etc. are entirely unaffected.
      try {
        await OneSignal.init({
          appId,
          allowLocalhostAsSecureOrigin: process.env.NODE_ENV !== 'production',
          // Explicitly disable the SDK's auto-prompt — Rostiro requests
          // permission only via an explicit user action (onboarding Step 5 /
          // settings), never on page load.
          promptOptions: {
            slidedown: {
              prompts: [{ type: 'push', autoPrompt: false }],
            },
          },
        })

        const existingId = OneSignal.User.PushSubscription.id
        if (existingId) reportSubscriptionId(existingId)

        OneSignal.User.PushSubscription.addEventListener('change', (event) => {
          if (event.current.id) reportSubscriptionId(event.current.id)
        })
      } catch (err) {
        console.warn('[push] OneSignal initialization failed; push notifications are unavailable this session.', err)
      }
    })
  }, [])

  return null
}
