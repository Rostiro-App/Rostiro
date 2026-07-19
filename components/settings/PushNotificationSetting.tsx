'use client'

// P3.5-4C (+ correction pass): the explicit, honest push opt-in/opt-out UI.
// Renders directly off lib/pushSubscription.ts's state machine — "enabled"
// only ever means OneSignal confirmed a real, opted-in subscription that the
// server persisted. No permission request happens on mount; enabling and
// disabling are only ever the button's onClick.
//
// States surfaced: initializing (neutral "checking", never premature
// "unsupported"), unsupported, available, requesting, subscribed (with an
// explicit Disable), denied (instructions, no re-prompt), failed (retry),
// disabling, disableFailed (honest — never silently shows enabled), and
// initializationFailed (the SDK never started — reload copy, no inert retry).

import { useSyncExternalStore } from 'react'
import {
  getPushSubscriptionState,
  getServerPushSubscriptionState,
  subscribePushSubscriptionState,
  requestPushSubscription,
  disablePushSubscription,
  type PushSubscriptionState,
} from '@/lib/pushSubscription'

export default function PushNotificationSetting() {
  const state = useSyncExternalStore(
    subscribePushSubscriptionState,
    getPushSubscriptionState,
    getServerPushSubscriptionState
  )

  return (
    <div className="flex items-center justify-between py-1">
      <div>
        <p className="text-sm text-white">Push notifications</p>
        <p className="text-xs mt-0.5" style={{ color: 'var(--t3)' }}>
          {copyFor(state)}
        </p>
      </div>
      {actionFor(state)}
    </div>
  )
}

function copyFor(state: PushSubscriptionState): string {
  switch (state) {
    case 'initializing':
      return 'Checking notification availability…'
    case 'unsupported':
      return 'Not supported in this browser.'
    case 'available':
      return 'Critical Pulse items: injuries to starters, deadlines inside 48h.'
    case 'requesting':
      return 'Waiting on your browser permission…'
    case 'subscribed':
      return "You're subscribed on this device."
    case 'denied':
      return "Blocked in your browser. Open this site's notification settings in your browser and allow notifications to enable."
    case 'failed':
      return "That didn't complete. You can try again."
    case 'disabling':
      return 'Turning off notifications on this device…'
    case 'disableFailed':
      return "We couldn't fully turn these off — try again."
    case 'initializationFailed':
      return "Notifications couldn't start. Reload this page to try again."
  }
}

function actionFor(state: PushSubscriptionState) {
  switch (state) {
    case 'initializing':
    case 'unsupported':
    case 'denied':
    // The SDK never started — there is nothing to retry against, so no button.
    // The copy ("Reload this page to try again") is the honest recovery path.
    case 'initializationFailed':
      return null

    case 'subscribed':
      return (
        <button
          type="button"
          onClick={() => {
            void disablePushSubscription()
          }}
          className="text-xs font-semibold px-3 py-1.5 rounded-lg flex-shrink-0 transition-all"
          style={{ color: 'var(--t1)', border: '1px solid var(--hairline)' }}
        >
          Disable
        </button>
      )

    case 'disabling':
      return (
        <button
          type="button"
          disabled
          className="text-xs font-semibold px-3 py-1.5 rounded-lg flex-shrink-0 opacity-50"
          style={{ color: 'var(--t1)', border: '1px solid var(--hairline)' }}
        >
          Disabling…
        </button>
      )

    case 'requesting':
      return (
        <button
          type="button"
          disabled
          className="text-xs font-semibold px-3 py-1.5 rounded-lg flex-shrink-0 opacity-50"
          style={{ backgroundColor: 'var(--cta)', color: '#fff' }}
        >
          Requesting…
        </button>
      )

    case 'available':
    case 'failed':
    case 'disableFailed': {
      const isRetry = state === 'failed' || state === 'disableFailed'
      const onClick =
        state === 'disableFailed'
          ? () => void disablePushSubscription()
          : () => void requestPushSubscription()
      return (
        <button
          type="button"
          onClick={onClick}
          className="text-xs font-semibold px-3 py-1.5 rounded-lg flex-shrink-0 transition-all"
          style={{ backgroundColor: 'var(--cta)', color: '#fff' }}
        >
          {isRetry ? 'Try again' : 'Enable notifications'}
        </button>
      )
    }
  }
}
