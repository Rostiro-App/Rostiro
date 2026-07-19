'use client'

// P3.5-4C (+ two Codex correction passes): the honest opt-in push subscription
// state machine AND the single client-side synchronization owner. Nothing else
// in the app talks to /api/push/subscribe — components/OneSignalInit.tsx only
// inits the SDK once (no auto-prompt) and hands the resolved SDK here.
//
// Invariants:
//   1. Displayed state is driven by the *real* OneSignal SDK (isPushSupported,
//      native Notification permission, PushSubscription.id/.optedIn) reconciled
//      with the server's acknowledgement — never a preference toggle.
//      "Subscribed" only ever means a real, opted-in subscription the server
//      confirmed persisting.
//   2. The server owns users.push_enabled. This module never PATCHes it; it
//      POSTs (register) / DELETEs (unregister) subscription ids.
//   3. Server cleanup is *honest*: a failed DELETE is never presented as
//      success. A lost/denied/inactive subscription is not shown as cleaned up
//      until the server confirms it.
//   4. Cleanup survives OneSignal clearing the live SDK id: we retain the
//      last-known subscription id so an inactive/denied/opted-out device can
//      still be unregistered and a failed disable can still be retried.
//
// Single-owner rule: exactly one 'change' listener is registered here, in
// setOneSignalSdk. A shared idempotent unregister coordinator dedupes DELETEs
// between the change listener and the explicit Disable so a delayed change
// event can't turn a successful disable into a false failure.

export type PushSubscriptionState =
  | 'initializing' // SDK not resolved yet — neutral, never "unsupported" prematurely
  | 'unsupported' // SDK/browser confirmed push can't work here
  | 'available' // supported, permitted-or-unprompted, no active subscription
  | 'requesting' // an explicit enable is in flight (awaiting the change event)
  | 'subscribed' // real opted-in subscription, confirmed persisted server-side
  | 'denied' // browser permission blocked — instructions, no re-prompt
  | 'failed' // an enable attempt failed/timed out — retryable in place
  | 'disabling' // an explicit disable is in flight
  | 'disableFailed' // server cleanup couldn't complete — honest, retryable
  | 'initializationFailed' // the SDK never started — NOT a retryable subscription
  //                          attempt; the only recovery is a page reload

interface OneSignalPushSubscriptionSdk {
  id: string | null | undefined
  optedIn: boolean | undefined
  optIn: () => unknown
  optOut: () => unknown
  addEventListener: (
    event: 'change',
    cb: (e: { previous?: { id?: string; optedIn?: boolean }; current?: { id?: string; optedIn?: boolean } }) => void
  ) => void
}

interface OneSignalNotificationsSdk {
  isPushSupported?: () => boolean
  permission: boolean
  requestPermission: () => unknown
}

export interface OneSignalSdkForSubscription {
  Notifications: OneSignalNotificationsSdk
  User: { PushSubscription: OneSignalPushSubscriptionSdk }
}

// How long an explicit enable waits for the documented subscription-change
// event before giving an honest "try again". A missing id right after the
// permission call resolves is NOT treated as failure.
export const ENABLE_TIMEOUT_MS = 12000

let state: PushSubscriptionState = 'initializing'
let sdk: OneSignalSdkForSubscription | null = null
let enableTimer: ReturnType<typeof setTimeout> | null = null
const listeners = new Set<() => void>()

// The last subscription id we've seen from the SDK or a change event. OneSignal
// clears PushSubscription.id on opt-out, but the server still holds a row keyed
// by that id — so we retain it here to unregister/retry. It is cleared ONLY
// after the server confirms the id is unregistered, or when replaced by a newly
// confirmed subscription. Never logged, never rendered.
let lastKnownSubscriptionId: string | null = null

// Idempotent unregister coordinator: dedupes concurrent DELETEs for one id
// (change listener + explicit Disable share a single request) and remembers
// ids the server has already confirmed removed, so a later attempt is a no-op
// success rather than a redundant DELETE or a false failure.
const inFlightUnregister = new Map<string, Promise<boolean>>()
const confirmedUnregistered = new Set<string>()

function setState(next: PushSubscriptionState) {
  if (state === next) return
  state = next
  listeners.forEach((l) => l())
}

function clearEnableTimer() {
  if (enableTimer) {
    clearTimeout(enableTimer)
    enableTimer = null
  }
}

function rememberSubscriptionId(id: string | null | undefined) {
  if (id) lastKnownSubscriptionId = id
}

export function getPushSubscriptionState(): PushSubscriptionState {
  return state
}

// SSR snapshot is fixed and hydration-safe (P3.5-3 paid for the lesson that a
// client-only value read during SSR mismatches on /pulse). "initializing" is
// the neutral pre-mount truth — never "unsupported".
export function getServerPushSubscriptionState(): PushSubscriptionState {
  return 'initializing'
}

export function subscribePushSubscriptionState(cb: () => void): () => void {
  listeners.add(cb)
  return () => listeners.delete(cb)
}

function nativeNotificationSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window
}

function nativePermission(): NotificationPermission | null {
  return nativeNotificationSupported() ? window.Notification.permission : null
}

function isPushSupported(): boolean {
  if (!sdk) return false
  return sdk.Notifications.isPushSupported ? sdk.Notifications.isPushSupported() : nativeNotificationSupported()
}

// The only two server calls in the whole client. Both return a plain boolean;
// no subscription id is ever logged or surfaced.
async function serverRegister(subscriptionId: string): Promise<boolean> {
  try {
    const res = await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subscriptionId }),
    })
    return res.ok
  } catch {
    return false
  }
}

async function serverUnregister(subscriptionId: string, opts?: { keepalive?: boolean }): Promise<boolean> {
  try {
    const res = await fetch('/api/push/subscribe', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subscriptionId }),
      ...(opts?.keepalive ? { keepalive: true } : {}),
    })
    return res.ok
  } catch {
    return false
  }
}

// Coordinated, idempotent unregister. Returns true if the server has confirmed
// the id removed (now or earlier). On success it clears the retained id (if it
// matches) and records the id as confirmed-removed so racing/delayed callers
// short-circuit instead of issuing a second DELETE or reporting a false failure.
function unregisterDevice(subscriptionId: string): Promise<boolean> {
  if (confirmedUnregistered.has(subscriptionId)) return Promise.resolve(true)
  const existing = inFlightUnregister.get(subscriptionId)
  if (existing) return existing
  const p = serverUnregister(subscriptionId)
    .then((ok) => {
      if (ok) {
        confirmedUnregistered.add(subscriptionId)
        if (lastKnownSubscriptionId === subscriptionId) lastKnownSubscriptionId = null
      }
      return ok
    })
    .finally(() => {
      inFlightUnregister.delete(subscriptionId)
    })
  inFlightUnregister.set(subscriptionId, p)
  return p
}

function markRegistered(subscriptionId: string) {
  // A newly confirmed subscription replaces the retained id and cancels any
  // "already unregistered" memory for it (it's live again).
  lastKnownSubscriptionId = subscriptionId
  confirmedUnregistered.delete(subscriptionId)
}

function deriveIdleState() {
  if (!sdk) {
    setState('initializing')
    return
  }
  if (!isPushSupported()) {
    setState('unsupported')
    return
  }
  if (nativePermission() === 'denied') {
    setState('denied')
    return
  }
  setState('available')
}

// The single 'change' listener. Reconciles the SDK's subscription truth with
// the server: a materialized opted-in subscription registers; a lost one
// (opt-out / removal / denial) unregisters — honestly (a failed DELETE →
// disableFailed, never a silent success).
async function handleChange(event: {
  previous?: { id?: string; optedIn?: boolean }
  current?: { id?: string; optedIn?: boolean }
}) {
  const previous = event?.previous ?? {}
  const current = event?.current ?? {}
  rememberSubscriptionId(current.id)
  rememberSubscriptionId(previous.id)

  if (current.id && current.optedIn === true) {
    const ok = await serverRegister(current.id)
    clearEnableTimer()
    if (ok) {
      markRegistered(current.id)
      setState('subscribed')
    } else {
      setState('failed')
    }
    return
  }

  // Subscription lost (opt-out / removal / denial). Prefer the best id we can
  // name, falling back to the retained one since the SDK may have cleared its
  // live field.
  const bestId = current.id ?? previous.id ?? lastKnownSubscriptionId
  clearEnableTimer()
  if (bestId) {
    const ok = await unregisterDevice(bestId)
    if (!ok) {
      setState('disableFailed')
      return
    }
  }
  if (nativePermission() === 'denied') {
    setState('denied')
    return
  }
  deriveIdleState()
}

// Additive hooks used by OneSignalInit for the config/failure edges.
export function markUnsupported() {
  setState('unsupported')
}

export function markFailed() {
  // A transient failure must not erase a subscription the user already earned.
  if (state === 'subscribed') return
  setState('failed')
}

// A distinct, terminal-for-this-session failure: OneSignal.init itself rejected,
// so the SDK never handed off and there is nothing to "try again" against. The
// UI must tell the user to reload rather than offer an inert retry button. Kept
// separate from markFailed (a retryable registration failure where an SDK
// exists). Never erases a subscription already earned this session.
export function markInitializationFailed() {
  if (state === 'subscribed') return
  setState('initializationFailed')
}

// Handed the resolved SDK by OneSignalInit. Registers THE one change listener
// and reconciles the initial subscription state with the server before
// presenting the final state.
export function setOneSignalSdk(instance: OneSignalSdkForSubscription) {
  sdk = instance
  sdk.User.PushSubscription.addEventListener('change', (e) => {
    void handleChange(e)
  })
  void initialSync()
}

async function initialSync() {
  if (!sdk) return
  if (!isPushSupported()) {
    setState('unsupported')
    return
  }
  const sub = sdk.User.PushSubscription
  rememberSubscriptionId(sub.id)
  const permission = nativePermission()

  // Permission denied: a lingering server row for this device would keep the
  // kill switch on after reopen — unregister it first, honestly.
  if (permission === 'denied') {
    const id = sub.id ?? lastKnownSubscriptionId
    if (id) {
      const ok = await unregisterDevice(id)
      setState(ok ? 'denied' : 'disableFailed')
    } else {
      setState('denied')
    }
    return
  }

  // Real, opted-in subscription: sync (register-before-subscribed) so the
  // server has this device before we show "enabled".
  if (sub.id && sub.optedIn) {
    setState('initializing') // stay neutral while syncing
    const ok = await serverRegister(sub.id)
    if (ok) {
      markRegistered(sub.id)
      setState('subscribed')
    } else {
      setState('failed')
    }
    return
  }

  // An id exists but the subscription is inactive (opted out) — a stale server
  // row + push_enabled=true would otherwise survive reopen. Unregister first.
  if (sub.id && !sub.optedIn) {
    const ok = await unregisterDevice(sub.id)
    setState(ok ? 'available' : 'disableFailed')
    return
  }

  // No id at all.
  setState('available')
}

// The one explicit, user-invoked enable. Never called on mount.
export async function requestPushSubscription(): Promise<void> {
  if (!sdk) return
  if (state !== 'available' && state !== 'failed') return
  setState('requesting')

  // Already a real, opted-in subscription — e.g. a retry after the initial
  // server registration failed. optIn()/requestPermission() would both no-op
  // here (permission is granted and the device is opted in), firing no change
  // event and therefore no second POST. Re-register the existing id directly.
  const active = sdk.User.PushSubscription
  if (active.id && active.optedIn === true) {
    rememberSubscriptionId(active.id)
    const ok = await serverRegister(active.id)
    clearEnableTimer()
    if (ok) {
      markRegistered(active.id)
      setState('subscribed')
    } else {
      setState('failed')
    }
    return
  }

  try {
    if (nativePermission() === 'granted') {
      // Browser already granted permission but the subscription isn't opted
      // in — opt in, do NOT re-request permission (it would no-op).
      await Promise.resolve(sdk.User.PushSubscription.optIn())
    } else {
      // Not yet granted (default) — request the native prompt, only from this
      // explicit action.
      await Promise.resolve(sdk.Notifications.requestPermission())
    }
  } catch {
    clearEnableTimer()
    setState('failed')
    return
  }

  // An explicit denial is definitive — surface it now.
  if (nativePermission() === 'denied') {
    clearEnableTimer()
    setState('denied')
    return
  }

  // A confirmed subscription may already have arrived synchronously via the
  // change event; if so we're done. (Read fresh — the entry guard narrowed
  // `state`, but the change handler may have moved it since.)
  if (getPushSubscriptionState() === 'subscribed') return

  // Otherwise wait for the documented subscription-change event. A missing id
  // right now is NOT a failure — it may still arrive. Bound the wait.
  clearEnableTimer()
  if (getPushSubscriptionState() === 'requesting') {
    enableTimer = setTimeout(() => {
      if (getPushSubscriptionState() === 'requesting') setState('failed')
      enableTimer = null
    }, ENABLE_TIMEOUT_MS)
  }
}

// The one explicit, user-invoked disable. Opts the device out and unregisters
// it — genuinely retryable: the retained id survives OneSignal clearing the
// live field, so "Try again" from disableFailed still identifies the row.
export async function disablePushSubscription(): Promise<void> {
  if (!sdk) return
  if (state !== 'subscribed' && state !== 'disableFailed') return
  // Capture the id BEFORE optOut (which may clear the live SDK field), falling
  // back to the retained id for a retry where the live field is already null.
  const deviceId = sdk.User.PushSubscription.id ?? lastKnownSubscriptionId
  rememberSubscriptionId(deviceId)
  setState('disabling')

  try {
    await Promise.resolve(sdk.User.PushSubscription.optOut())
  } catch {
    // optOut failing locally shouldn't strand the server row — still attempt
    // to unregister below.
  }

  if (!deviceId) {
    setState('disableFailed')
    return
  }
  const ok = await unregisterDevice(deviceId)
  // Never fall back to "enabled" on a failed server unregister — say so, and
  // keep the retained id so the retry can find the row. On success, derive the
  // honest idle state rather than hardcoding "available": a device disabled
  // while permission is denied must land on "denied", an unsupported one on
  // "unsupported", etc.
  if (ok) {
    deriveIdleState()
  } else {
    setState('disableFailed')
  }
}

// Logout lifecycle: remove THIS browser's subscription association before the
// session is destroyed, fail-safe. Local optOut and the server DELETE are both
// STARTED without one blocking the other, so even if the server request misses
// the caller's window, the browser is still locally opted out and cannot keep
// receiving the previous account's pushes. Best-effort: never throws, other
// devices untouched. keepalive lets the DELETE attempt delivery past navigation
// (not a guarantee).
export async function unregisterCurrentDeviceForLogout(): Promise<void> {
  if (!sdk) return
  const deviceId = sdk.User.PushSubscription.id ?? lastKnownSubscriptionId

  // Start the local opt-out immediately and unconditionally (it's the actual
  // safety net — it stops delivery even with no server id).
  const optOutDone = (async () => {
    try {
      await Promise.resolve(sdk!.User.PushSubscription.optOut())
    } catch {
      // best-effort
    }
  })()

  // Start the server DELETE in parallel (keepalive so it can outlive the page).
  const serverDone = deviceId
    ? serverUnregister(deviceId, { keepalive: true }).catch(() => false)
    : Promise.resolve(false)

  await Promise.allSettled([optOutDone, serverDone])
}

// Test-only reset.
export function __resetPushSubscriptionStateForTests() {
  clearEnableTimer()
  state = 'initializing'
  sdk = null
  listeners.clear()
  lastKnownSubscriptionId = null
  inFlightUnregister.clear()
  confirmedUnregistered.clear()
}
