'use client'

// OneSignal Web SDK init (PRD 6.6). Mounted once in the root layout. Pushes
// an init call onto window.OneSignalDeferred (queued by the CDN script tag
// in app/layout.tsx, which may still be loading when this runs — that's the
// whole point of the deferred-push pattern), then hands the resolved SDK to
// lib/pushSubscription.ts.
//
// P3.5-4C correction (Codex review): this component NO LONGER reports
// subscriptions or registers its own 'change' listener. All server
// synchronization now has a single owner — lib/pushSubscription.ts — so the
// client and server can't drift. OneSignalInit's remaining job is narrow:
//   • init the SDK exactly once per page lifecycle (P3.5-4A once-init guard);
//   • never auto-prompt (P3.5-4A: autoPrompt false, no prompt API on load);
//   • hand the SDK to the sync owner, or report the honest edge states
//     (missing config → unsupported, init failure → initializationFailed) to it.
//
// Rostiro requests notification permission only through an explicit user
// action in Settings (lib/pushSubscription.requestPushSubscription), never
// here. As defense in depth, the OneSignal dashboard's auto-prompt config
// must also remain disabled (Settings → Push & In-App → Web Settings).

import { useEffect } from 'react'
import { setOneSignalSdk, markUnsupported, markInitializationFailed } from '@/lib/pushSubscription'

// Narrow slice of OneSignal's init options — only the fields Rostiro sets.
// promptOptions pins autoPrompt: false so the SDK never shows its own prompt.
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
  User: { PushSubscription: unknown }
  Notifications: unknown
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

export default function OneSignalInit() {
  useEffect(() => {
    const appId = process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID
    if (!appId) {
      // No push configured in this deployment — tell the sync owner so the
      // Settings UI resolves out of its neutral "checking" state honestly.
      markUnsupported()
      return
    }
    // At most once per page lifecycle (guards remounts / Strict Mode's
    // double-invoked effect from queuing a second init).
    if (window.__rostiroPushInitStarted) return
    window.__rostiroPushInitStarted = true

    window.OneSignalDeferred = window.OneSignalDeferred ?? []
    window.OneSignalDeferred.push(async (OneSignal) => {
      // P3.5-4A: the whole callback is wrapped — a slow, blocked, or failed
      // OneSignal.init() previously rejected here with no catch, surfacing as
      // an UNHANDLED promise rejection. Push is strictly optional and must
      // never do that or block the app, so we catch, log once honestly, and
      // continue.
      try {
        await OneSignal.init({
          appId,
          allowLocalhostAsSecureOrigin: process.env.NODE_ENV !== 'production',
          // Explicitly disable the SDK's auto-prompt — permission is requested
          // only via an explicit user action in Settings, never on load.
          promptOptions: {
            slidedown: {
              prompts: [{ type: 'push', autoPrompt: false }],
            },
          },
        })

        // Hand off to the single synchronization owner. It registers the one
        // 'change' listener and syncs any existing subscription with the server
        // before presenting the enabled state.
        setOneSignalSdk(OneSignal as unknown as Parameters<typeof setOneSignalSdk>[0])
      } catch (err) {
        console.warn('[push] OneSignal initialization failed; push notifications are unavailable this session.', err)
        // Distinct from a subscription-registration failure: the SDK never
        // started, so there is nothing to retry in place — Settings tells the
        // user to reload rather than showing an inert "Try again".
        markInitializationFailed()
      }
    })
  }, [])

  return null
}
