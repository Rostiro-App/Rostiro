// P3.5-4C correction pass: the client sync-owner state machine.
//
// The real OneSignal SDK is never contacted — a mock matching the documented
// Web SDK v16 surface stands in (Notifications.isPushSupported/permission/
// requestPermission, User.PushSubscription.id/optedIn/optIn/optOut/
// addEventListener). The properties proven here: no permission request except
// via the explicit enable; enable uses requestPermission (default) vs optIn
// (already granted); a delayed change event completes the subscription; a
// missing subscription times out to an honest retry state; denial/opt-out
// unregister the device; disable opts out and unregisters; the client never
// PATCHes users.push_enabled; logout removes only the current device; and the
// neutral "initializing" state is the pre-SDK truth.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  getPushSubscriptionState,
  getServerPushSubscriptionState,
  subscribePushSubscriptionState,
  setOneSignalSdk,
  markUnsupported,
  markFailed,
  requestPushSubscription,
  disablePushSubscription,
  unregisterCurrentDeviceForLogout,
  __resetPushSubscriptionStateForTests,
  ENABLE_TIMEOUT_MS,
  type OneSignalSdkForSubscription,
} from './pushSubscription'

interface MockSub {
  id: string | null
  optedIn: boolean | undefined
  optIn: ReturnType<typeof vi.fn>
  optOut: ReturnType<typeof vi.fn>
  addEventListener: ReturnType<typeof vi.fn>
  __fire: (e: { previous?: { id?: string; optedIn?: boolean }; current?: { id?: string; optedIn?: boolean } }) => void
}

function makeMockSdk(opts: {
  isPushSupported?: boolean
  subId?: string | null
  optedIn?: boolean
  requestPermission?: () => unknown
} = {}) {
  const changeListeners: Array<(e: unknown) => void> = []
  const sub: MockSub = {
    id: opts.subId ?? null,
    optedIn: opts.optedIn,
    optIn: vi.fn(),
    optOut: vi.fn(),
    addEventListener: vi.fn((_ev: string, cb: (e: unknown) => void) => changeListeners.push(cb)),
    __fire: (e) => changeListeners.forEach((cb) => cb(e)),
  }
  const sdk: OneSignalSdkForSubscription = {
    Notifications: {
      isPushSupported: opts.isPushSupported === undefined ? undefined : () => opts.isPushSupported!,
      permission: false,
      requestPermission: vi.fn(opts.requestPermission ?? (() => Promise.resolve())),
    },
    User: { PushSubscription: sub as unknown as OneSignalSdkForSubscription['User']['PushSubscription'] },
  }
  return { sdk, sub }
}

function setPermission(p: NotificationPermission) {
  Object.defineProperty(window, 'Notification', { value: { permission: p }, configurable: true, writable: true })
}

// Drain all pending microtasks (async change handlers await a fetch, so a
// single Promise.resolve() isn't enough to see the settled state).
function flush() {
  return new Promise((resolve) => setTimeout(resolve, 0))
}

interface FetchCall { url: string; method: string; body: unknown }
function fetchCalls(): FetchCall[] {
  const calls = (global.fetch as unknown as { mock: { calls: [string, { method: string; body: string }][] } }).mock.calls
  return calls.map(([url, opts]) => ({ url, method: opts.method, body: opts.body ? JSON.parse(opts.body) : undefined }))
}
function callsTo(url: string, method?: string) {
  return fetchCalls().filter((c) => c.url === url && (method ? c.method === method : true))
}

beforeEach(() => {
  __resetPushSubscriptionStateForTests()
  setPermission('default')
  global.fetch = vi.fn(async () => ({ ok: true, json: async () => ({}) })) as never
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.useRealTimers()
})

describe('pushSubscription — sync owner state machine (P3.5-4C correction)', () => {
  it('server snapshot and initial client state are the neutral "initializing"', () => {
    expect(getServerPushSubscriptionState()).toBe('initializing')
    expect(getPushSubscriptionState()).toBe('initializing')
  })

  it('markUnsupported / markFailed set their states; markFailed never downgrades a subscribed user', async () => {
    markUnsupported()
    expect(getPushSubscriptionState()).toBe('unsupported')

    __resetPushSubscriptionStateForTests()
    setPermission('default')
    markFailed()
    expect(getPushSubscriptionState()).toBe('failed')

    const { sdk } = makeMockSdk({ isPushSupported: true, subId: 'sub-1', optedIn: true })
    setOneSignalSdk(sdk)
    await flush()
    expect(getPushSubscriptionState()).toBe('subscribed')
    markFailed()
    expect(getPushSubscriptionState()).toBe('subscribed')
  })

  it('unsupported browser reports "unsupported"', async () => {
    const { sdk } = makeMockSdk({ isPushSupported: false })
    setOneSignalSdk(sdk)
    await flush()
    expect(getPushSubscriptionState()).toBe('unsupported')
  })

  it('supported browser with no subscription reports "available" and makes no server call', async () => {
    const { sdk } = makeMockSdk({ isPushSupported: true })
    setOneSignalSdk(sdk)
    await flush()
    expect(getPushSubscriptionState()).toBe('available')
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('EXISTING SUBSCRIBER synchronizes registration with the server before showing enabled', async () => {
    const { sdk } = makeMockSdk({ isPushSupported: true, subId: 'existing', optedIn: true })
    setOneSignalSdk(sdk)
    await flush()
    expect(getPushSubscriptionState()).toBe('subscribed')
    const posts = callsTo('/api/push/subscribe', 'POST')
    expect(posts).toHaveLength(1)
    expect(posts[0].body).toEqual({ subscriptionId: 'existing' })
  })

  it('a failed server registration never shows enabled', async () => {
    global.fetch = vi.fn(async () => ({ ok: false, json: async () => ({}) })) as never
    const { sdk } = makeMockSdk({ isPushSupported: true, subId: 'existing', optedIn: true })
    setOneSignalSdk(sdk)
    await flush()
    expect(getPushSubscriptionState()).toBe('failed')
  })

  it('a subscription id without optedIn is never treated as subscribed', async () => {
    const { sdk } = makeMockSdk({ isPushSupported: true, subId: 'sub', optedIn: false })
    setOneSignalSdk(sdk)
    await flush()
    expect(getPushSubscriptionState()).toBe('available')
  })

  it('native denied permission reports "denied"', async () => {
    setPermission('denied')
    const { sdk } = makeMockSdk({ isPushSupported: true })
    setOneSignalSdk(sdk)
    await flush()
    expect(getPushSubscriptionState()).toBe('denied')
  })

  it('requestPushSubscription is a no-op before an SDK is attached', async () => {
    await requestPushSubscription()
    expect(getPushSubscriptionState()).toBe('initializing')
  })

  it('ENABLE with default permission calls requestPermission (not optIn)', async () => {
    const { sdk, sub } = makeMockSdk({ isPushSupported: true })
    setOneSignalSdk(sdk)
    await flush()
    await requestPushSubscription()
    expect(sdk.Notifications.requestPermission).toHaveBeenCalledTimes(1)
    expect(sub.optIn).not.toHaveBeenCalled()
  })

  it('ENABLE with permission already granted but optedIn=false calls optIn (not requestPermission)', async () => {
    setPermission('granted')
    const { sdk, sub } = makeMockSdk({ isPushSupported: true, subId: null, optedIn: false })
    setOneSignalSdk(sdk)
    await flush()
    await requestPushSubscription()
    expect(sub.optIn).toHaveBeenCalledTimes(1)
    expect(sdk.Notifications.requestPermission).not.toHaveBeenCalled()
  })

  it('a DELAYED subscription-change event completes the subscription successfully', async () => {
    const { sdk, sub } = makeMockSdk({ isPushSupported: true })
    setOneSignalSdk(sdk)
    await flush()
    await requestPushSubscription()
    expect(getPushSubscriptionState()).toBe('requesting')

    // The subscription materializes a moment later via the documented event.
    sub.id = 'delayed-sub'
    sub.optedIn = true
    sub.__fire({ previous: { id: undefined, optedIn: false }, current: { id: 'delayed-sub', optedIn: true } })
    await flush()

    expect(getPushSubscriptionState()).toBe('subscribed')
    expect(callsTo('/api/push/subscribe', 'POST')).toHaveLength(1)
  })

  it('a missing subscription within the timeout window yields an honest retry state', async () => {
    vi.useFakeTimers()
    const { sdk } = makeMockSdk({ isPushSupported: true })
    setOneSignalSdk(sdk)
    await requestPushSubscription()
    expect(getPushSubscriptionState()).toBe('requesting')
    await vi.advanceTimersByTimeAsync(ENABLE_TIMEOUT_MS + 1)
    expect(getPushSubscriptionState()).toBe('failed')
  })

  it('DENIED permission during a change event unregisters the current device', async () => {
    const { sdk, sub } = makeMockSdk({ isPushSupported: true, subId: 'sub-1', optedIn: true })
    setOneSignalSdk(sdk)
    await flush()
    expect(getPushSubscriptionState()).toBe('subscribed')

    setPermission('denied')
    sub.optedIn = false
    sub.__fire({ previous: { id: 'sub-1', optedIn: true }, current: { id: 'sub-1', optedIn: false } })
    await flush()

    expect(getPushSubscriptionState()).toBe('denied')
    expect(callsTo('/api/push/subscribe', 'DELETE').some((c) => (c.body as { subscriptionId: string }).subscriptionId === 'sub-1')).toBe(true)
  })

  it('an external opt-out change event unregisters the device and returns to "available"', async () => {
    const { sdk, sub } = makeMockSdk({ isPushSupported: true, subId: 'sub-1', optedIn: true })
    setOneSignalSdk(sdk)
    await flush()

    sub.optedIn = false
    sub.__fire({ previous: { id: 'sub-1', optedIn: true }, current: { id: 'sub-1', optedIn: false } })
    await flush()

    expect(getPushSubscriptionState()).toBe('available')
    expect(callsTo('/api/push/subscribe', 'DELETE')).toHaveLength(1)
  })

  it('DISABLE opts the device out and unregisters it', async () => {
    const { sdk, sub } = makeMockSdk({ isPushSupported: true, subId: 'sub-1', optedIn: true })
    setOneSignalSdk(sdk)
    await flush()
    expect(getPushSubscriptionState()).toBe('subscribed')

    await disablePushSubscription()
    expect(sub.optOut).toHaveBeenCalledTimes(1)
    expect(callsTo('/api/push/subscribe', 'DELETE')).toHaveLength(1)
    expect(getPushSubscriptionState()).toBe('available')
  })

  it('DISABLE that fails to unregister server-side never shows enabled — it reports disableFailed', async () => {
    global.fetch = vi
      .fn()
      .mockImplementationOnce(async () => ({ ok: true, json: async () => ({}) })) // initial register
      .mockImplementation(async () => ({ ok: false, json: async () => ({}) })) as never
    const { sdk } = makeMockSdk({ isPushSupported: true, subId: 'sub-1', optedIn: true })
    setOneSignalSdk(sdk)
    await flush()
    expect(getPushSubscriptionState()).toBe('subscribed')

    await disablePushSubscription()
    expect(getPushSubscriptionState()).toBe('disableFailed')
  })

  it('the client NEVER PATCHes /api/settings across a full enable→subscribe flow', async () => {
    const { sdk, sub } = makeMockSdk({ isPushSupported: true })
    setOneSignalSdk(sdk)
    await flush()
    await requestPushSubscription()
    sub.id = 'sub-x'
    sub.optedIn = true
    sub.__fire({ previous: {}, current: { id: 'sub-x', optedIn: true } })
    await flush()
    expect(getPushSubscriptionState()).toBe('subscribed')
    expect(callsTo('/api/settings')).toHaveLength(0)
  })

  it('LOGOUT attempts BOTH a local optOut and a keepalive server DELETE for the current device', async () => {
    const { sdk, sub } = makeMockSdk({ isPushSupported: true, subId: 'current-device', optedIn: true })
    setOneSignalSdk(sdk)
    await flush()
    ;(global.fetch as unknown as { mockClear: () => void }).mockClear()

    await unregisterCurrentDeviceForLogout()

    expect(sub.optOut).toHaveBeenCalledTimes(1)
    const deletes = callsTo('/api/push/subscribe', 'DELETE')
    expect(deletes).toHaveLength(1)
    expect(deletes[0].body).toEqual({ subscriptionId: 'current-device' })
    const rawDelete = (global.fetch as unknown as { mock: { calls: [string, { method: string; keepalive?: boolean }][] } }).mock.calls.find(
      (c) => c[1].method === 'DELETE'
    )
    expect(rawDelete?.[1].keepalive).toBe(true)
  })

  it('LOGOUT still attempts a local optOut when there is no server id (local safety net)', async () => {
    const { sdk, sub } = makeMockSdk({ isPushSupported: true, subId: null, optedIn: true })
    setOneSignalSdk(sdk)
    await flush()
    ;(global.fetch as unknown as { mockClear: () => void }).mockClear()

    await unregisterCurrentDeviceForLogout()
    expect(sub.optOut).toHaveBeenCalledTimes(1)
    expect(callsTo('/api/push/subscribe', 'DELETE')).toHaveLength(0)
  })

  it('LOGOUT resolves without throwing even when optOut throws and the DELETE rejects', async () => {
    global.fetch = vi
      .fn()
      .mockImplementationOnce(async () => ({ ok: true, json: async () => ({}) })) // initial register
      .mockImplementation(async () => {
        throw new Error('network')
      }) as never
    const { sdk, sub } = makeMockSdk({ isPushSupported: true, subId: 'current-device', optedIn: true })
    setOneSignalSdk(sdk)
    await flush()
    sub.optOut.mockImplementation(() => {
      throw new Error('sdk boom')
    })
    await expect(unregisterCurrentDeviceForLogout()).resolves.toBeUndefined()
    expect(sub.optOut).toHaveBeenCalled()
  })

  // ─── Adversarial lifecycle regressions (Codex correction pass) ──────────────

  it('INITIAL inactive subscription (id present, optedIn=false) unregisters before showing available', async () => {
    const { sdk } = makeMockSdk({ isPushSupported: true, subId: 'stale', optedIn: false })
    setOneSignalSdk(sdk)
    await flush()
    const deletes = callsTo('/api/push/subscribe', 'DELETE')
    expect(deletes).toHaveLength(1)
    expect(deletes[0].body).toEqual({ subscriptionId: 'stale' })
    expect(getPushSubscriptionState()).toBe('available')
  })

  it('INITIAL denied permission with an existing id unregisters before showing denied', async () => {
    setPermission('denied')
    const { sdk } = makeMockSdk({ isPushSupported: true, subId: 'stale', optedIn: true })
    setOneSignalSdk(sdk)
    await flush()
    expect(callsTo('/api/push/subscribe', 'DELETE')).toHaveLength(1)
    expect(getPushSubscriptionState()).toBe('denied')
  })

  it('INITIAL inactive unregister FAILURE shows disableFailed, not a false available', async () => {
    global.fetch = vi.fn(async () => ({ ok: false, json: async () => ({}) })) as never
    const { sdk } = makeMockSdk({ isPushSupported: true, subId: 'stale', optedIn: false })
    setOneSignalSdk(sdk)
    await flush()
    expect(getPushSubscriptionState()).toBe('disableFailed')
  })

  it('EXTERNAL opt-out whose server DELETE fails shows disableFailed, not available', async () => {
    global.fetch = vi
      .fn()
      .mockImplementationOnce(async () => ({ ok: true, json: async () => ({}) })) // initial register
      .mockImplementation(async () => ({ ok: false, json: async () => ({}) })) as never
    const { sdk, sub } = makeMockSdk({ isPushSupported: true, subId: 'sub-1', optedIn: true })
    setOneSignalSdk(sdk)
    await flush()
    expect(getPushSubscriptionState()).toBe('subscribed')

    sub.optedIn = false
    sub.__fire({ previous: { id: 'sub-1', optedIn: true }, current: { id: 'sub-1', optedIn: false } })
    await flush()
    expect(getPushSubscriptionState()).toBe('disableFailed')
  })

  it('a FAILED disable is retryable via the retained id even after the SDK clears its live id', async () => {
    let deleteOk = false
    global.fetch = vi.fn(async (_url: string, opts: { method: string }) => {
      if (opts.method === 'POST') return { ok: true, json: async () => ({}) }
      return { ok: deleteOk, json: async () => ({}) }
    }) as never
    const { sdk, sub } = makeMockSdk({ isPushSupported: true, subId: 'sub-1', optedIn: true })
    setOneSignalSdk(sdk)
    await flush()
    expect(getPushSubscriptionState()).toBe('subscribed')

    // optOut clears the live SDK id, and the server DELETE fails.
    sub.optOut.mockImplementation(() => {
      sub.id = null
      sub.optedIn = false
    })
    await disablePushSubscription()
    expect(getPushSubscriptionState()).toBe('disableFailed')
    expect(sdk.User.PushSubscription.id).toBeNull()

    // Retry: server now succeeds; the retained id identifies the row.
    deleteOk = true
    await disablePushSubscription()
    expect(getPushSubscriptionState()).toBe('available')
    const del = callsTo('/api/push/subscribe', 'DELETE')
    expect(del.every((c) => (c.body as { subscriptionId: string }).subscriptionId === 'sub-1')).toBe(true)
  })

  it('EXPLICIT disable then a delayed change event stays available — one DELETE, no false failure', async () => {
    const { sdk, sub } = makeMockSdk({ isPushSupported: true, subId: 'sub-1', optedIn: true })
    setOneSignalSdk(sdk)
    await flush()
    await disablePushSubscription()
    expect(getPushSubscriptionState()).toBe('available')

    sub.optedIn = false
    sub.__fire({ previous: { id: 'sub-1', optedIn: true }, current: { id: 'sub-1', optedIn: false } })
    await flush()

    expect(getPushSubscriptionState()).toBe('available')
    // Coordinator dedupe: the delayed event issues no second DELETE.
    expect(callsTo('/api/push/subscribe', 'DELETE')).toHaveLength(1)
  })

  it('a successful RE-REGISTRATION clears the id from already-unregistered tracking', async () => {
    const { sdk, sub } = makeMockSdk({ isPushSupported: true, subId: 'sub-1', optedIn: true })
    setOneSignalSdk(sdk)
    await flush() // register #1 → subscribed

    sub.optedIn = false
    sub.__fire({ previous: { id: 'sub-1', optedIn: true }, current: { id: 'sub-1', optedIn: false } })
    await flush() // DELETE #1 → available, id now cached as unregistered
    expect(getPushSubscriptionState()).toBe('available')

    sub.id = 'sub-1'
    sub.optedIn = true
    sub.__fire({ previous: { id: 'sub-1', optedIn: false }, current: { id: 'sub-1', optedIn: true } })
    await flush() // re-register → subscribed, tracking cleared
    expect(getPushSubscriptionState()).toBe('subscribed')

    const before = callsTo('/api/push/subscribe', 'DELETE').length
    sub.optedIn = false
    sub.__fire({ previous: { id: 'sub-1', optedIn: true }, current: { id: 'sub-1', optedIn: false } })
    await flush()
    // A fresh DELETE is issued (not a cached no-op), proving re-registration
    // cleared the "already unregistered" memory.
    expect(callsTo('/api/push/subscribe', 'DELETE').length).toBe(before + 1)
  })

  it('EXISTING SUBSCRIBER initial sync remains register-before-subscribed', async () => {
    const order: string[] = []
    global.fetch = vi.fn(async () => {
      order.push('register')
      return { ok: true, json: async () => ({}) }
    }) as never
    const { sdk } = makeMockSdk({ isPushSupported: true, subId: 'existing', optedIn: true })
    setOneSignalSdk(sdk)
    // Before the register resolves, state must not already be "subscribed".
    expect(getPushSubscriptionState()).not.toBe('subscribed')
    await flush()
    expect(order).toEqual(['register'])
    expect(getPushSubscriptionState()).toBe('subscribed')
  })

  it('initialization NEVER requests permission (no prompt on mount)', async () => {
    const { sdk } = makeMockSdk({ isPushSupported: true, subId: 'existing', optedIn: true })
    setOneSignalSdk(sdk)
    await flush()
    expect(sdk.Notifications.requestPermission).not.toHaveBeenCalled()
  })

  it('NEVER logs the subscription id through the lifecycle', async () => {
    const methods = ['log', 'warn', 'error', 'info', 'debug'] as const
    const spies = methods.map((m) => vi.spyOn(console, m).mockImplementation(() => {}))
    const { sdk, sub } = makeMockSdk({ isPushSupported: true, subId: 'SECRET-SUB-ID', optedIn: true })
    setOneSignalSdk(sdk)
    await flush()
    await disablePushSubscription()
    sub.__fire({ previous: { id: 'SECRET-SUB-ID', optedIn: true }, current: { id: undefined, optedIn: false } })
    await flush()
    const logged = spies.flatMap((s) => s.mock.calls.flat()).map(String).join(' | ')
    expect(logged).not.toContain('SECRET-SUB-ID')
  })

  it('subscribers are notified on transitions and can unsubscribe', async () => {
    const cb = vi.fn()
    const unsub = subscribePushSubscriptionState(cb)
    const { sdk } = makeMockSdk({ isPushSupported: true })
    setOneSignalSdk(sdk)
    await flush()
    expect(cb).toHaveBeenCalled()
    unsub()
    cb.mockClear()
    markUnsupported()
    expect(cb).not.toHaveBeenCalled()
  })

  it('registers exactly one change listener per setOneSignalSdk call', async () => {
    const { sdk, sub } = makeMockSdk({ isPushSupported: true })
    setOneSignalSdk(sdk)
    await flush()
    expect(sub.addEventListener).toHaveBeenCalledTimes(1)
  })

  // ─── Codex correction pass #2 (post-5a781da) regressions ────────────────────

  // TEST A: a failed initial registration for an ALREADY active+granted
  // subscription must be retryable by re-POSTing the SAME id directly — not by
  // calling optIn()/requestPermission(), which no-op when already opted in and
  // therefore fire no change event and no second POST.
  it('TEST A: retry from failed with an active granted subscription re-POSTs directly (no optIn/requestPermission)', async () => {
    setPermission('granted')
    let postOk = false
    global.fetch = vi.fn(async (_url: string, opts: { method: string }) => ({
      ok: opts.method === 'POST' ? postOk : true,
      json: async () => ({}),
    })) as never
    const { sdk, sub } = makeMockSdk({ isPushSupported: true, subId: 'existing-id', optedIn: true })
    setOneSignalSdk(sdk)
    await flush()
    // Initial registration failed → honest retry state, exactly one POST so far.
    expect(getPushSubscriptionState()).toBe('failed')
    expect(callsTo('/api/push/subscribe', 'POST')).toHaveLength(1)

    // Retry: the server now succeeds. The active subscription already exists,
    // so the retry must re-register directly.
    postOk = true
    await requestPushSubscription()
    await flush()
    expect(callsTo('/api/push/subscribe', 'POST')).toHaveLength(2)
    expect(getPushSubscriptionState()).toBe('subscribed')
    expect(sub.optIn).not.toHaveBeenCalled()
    expect(sdk.Notifications.requestPermission).not.toHaveBeenCalled()
  })

  // TEST B: retrying a failed cleanup while the browser permission is DENIED must
  // resolve to the honest idle state (denied), never a false "available".
  it('TEST B: retrying a failed cleanup while permission is denied ends at denied, not available', async () => {
    setPermission('denied')
    let deleteOk = false
    global.fetch = vi.fn(async (_url: string, opts: { method: string }) => ({
      ok: opts.method === 'DELETE' ? deleteOk : true,
      json: async () => ({}),
    })) as never
    const { sdk } = makeMockSdk({ isPushSupported: true, subId: 'stale-id', optedIn: false })
    setOneSignalSdk(sdk)
    await flush()
    // Denied + stale id: initial cleanup DELETE fails → honest disableFailed.
    expect(getPushSubscriptionState()).toBe('disableFailed')

    // Retry: DELETE now succeeds; permission is still denied.
    deleteOk = true
    await disablePushSubscription()
    await flush()
    expect(getPushSubscriptionState()).toBe('denied')
  })
})
