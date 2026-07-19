// Packet 3.5-4A — OneSignal push-init reliability regression coverage.
//
// The real SDK is never contacted. OneSignalInit's only side effect is to push
// an init callback onto window.OneSignalDeferred; the CDN SDK later drains that
// queue and calls the callback with the SDK object. These tests render the
// component, then simulate the SDK by invoking the queued callback with a
// mocked OneSignal — covering success, timeout/rejection, blocked load, missing
// config, duplicate mounts, permission-denied, and no-auto-prompt. The core
// safety property: the queued callback must NEVER reject (an unhandled
// rejection is exactly the historical "OneSignal SDK timeout" console error),
// and init must run at most once per page lifecycle.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import OneSignalInit from './OneSignalInit'

interface MockSubscription {
  id: string | null
  addEventListener: ReturnType<typeof vi.fn>
}
interface MockOneSignal {
  init: ReturnType<typeof vi.fn>
  User: { PushSubscription: MockSubscription }
  // Prompt surfaces that MUST NOT be auto-invoked on init.
  Slidedown: { promptPush: ReturnType<typeof vi.fn> }
  Notifications: { requestPermission: ReturnType<typeof vi.fn> }
  __changeListeners: Array<(e: { current: { id?: string } }) => void>
}

function makeMockOneSignal(opts: { init?: () => Promise<void>; subId?: string | null } = {}): MockOneSignal {
  const changeListeners: MockOneSignal['__changeListeners'] = []
  return {
    init: vi.fn(opts.init ?? (() => Promise.resolve())),
    User: {
      PushSubscription: {
        id: opts.subId ?? null,
        addEventListener: vi.fn((_ev: string, cb: (e: { current: { id?: string } }) => void) => changeListeners.push(cb)),
      },
    },
    Slidedown: { promptPush: vi.fn() },
    Notifications: { requestPermission: vi.fn() },
    __changeListeners: changeListeners,
  }
}

function queuedCallbacks() {
  return (window.OneSignalDeferred ?? []) as unknown as Array<(os: MockOneSignal) => Promise<void>>
}

function fetchCall(url: string) {
  const calls = (global.fetch as unknown as { mock: { calls: [string, { body: string }][] } }).mock.calls
  return calls.find((c) => c[0] === url)
}

// Simulate the CDN SDK draining the deferred queue exactly once.
async function drainQueue(mock: MockOneSignal) {
  const cbs = queuedCallbacks()
  for (const cb of cbs) await cb(mock)
}

beforeEach(() => {
  vi.stubEnv('NEXT_PUBLIC_ONESIGNAL_APP_ID', 'test-app-id')
  // Reset the per-page-lifecycle guard and queue between tests.
  delete (window as unknown as { OneSignalDeferred?: unknown }).OneSignalDeferred
  delete (window as unknown as { __rostiroPushInitStarted?: unknown }).__rostiroPushInitStarted
  global.fetch = vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve({}) })) as never
})

afterEach(() => {
  cleanup()
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

describe('OneSignalInit — push-init reliability (P3.5-4A)', () => {
  it('renders nothing and never throws (push is optional, never blocks the app)', () => {
    const { container } = render(<OneSignalInit />)
    expect(container.innerHTML).toBe('')
  })

  it('successful init reports the existing subscription id and registers a change listener', async () => {
    render(<OneSignalInit />)
    const mock = makeMockOneSignal({ subId: 'sub-123' })
    await drainQueue(mock)

    expect(mock.init).toHaveBeenCalledTimes(1)
    const call = fetchCall('/api/push/subscribe')
    expect(call).toBeTruthy()
    expect(JSON.parse(call![1].body).subscriptionId).toBe('sub-123')
    expect(mock.User.PushSubscription.addEventListener).toHaveBeenCalledWith('change', expect.any(Function))
  })

  it('PROOF: an SDK init timeout/rejection is caught — the queued callback never rejects (no unhandled rejection)', async () => {
    render(<OneSignalInit />)
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const mock = makeMockOneSignal({ init: () => Promise.reject(new Error('OneSignal init timed out')) })

    const cb = queuedCallbacks()[0]
    // The callback the SDK invokes MUST resolve, not reject — a rejected
    // promise here is the unhandled rejection we're eliminating.
    await expect(cb(mock)).resolves.toBeUndefined()
    // No subscription reported on failure; a single honest warn, not silence.
    expect(global.fetch).not.toHaveBeenCalledWith('/api/push/subscribe', expect.anything())
    expect(warn).toHaveBeenCalledTimes(1)
  })

  it('blocked/never-loaded SDK: the callback is simply queued and never runs — no error, app usable', () => {
    render(<OneSignalInit />)
    // SDK never drains the queue (script blocked). Exactly one callback waits;
    // nothing executes, nothing throws.
    expect(queuedCallbacks()).toHaveLength(1)
  })

  it('missing app ID exits quietly: nothing is queued', () => {
    vi.stubEnv('NEXT_PUBLIC_ONESIGNAL_APP_ID', '')
    render(<OneSignalInit />)
    expect(window.OneSignalDeferred ?? []).toHaveLength(0)
  })

  it('duplicate mounts / Strict Mode: init is attempted at most once per page lifecycle', async () => {
    render(<OneSignalInit />)
    cleanup()
    render(<OneSignalInit />)
    // Two mounts, but only one init callback queued.
    expect(queuedCallbacks()).toHaveLength(1)
    const mock = makeMockOneSignal({ subId: 'sub-1' })
    await drainQueue(mock)
    expect(mock.init).toHaveBeenCalledTimes(1)
  })

  it('permission denied (init ok, no subscription id): reports nothing, no error, resolves', async () => {
    render(<OneSignalInit />)
    const mock = makeMockOneSignal({ subId: null })
    await expect(drainQueue(mock)).resolves.toBeUndefined()
    expect(global.fetch).not.toHaveBeenCalledWith('/api/push/subscribe', expect.anything())
  })

  it('no automatic permission prompt on load: init explicitly disables autoPrompt and no prompt API is invoked', async () => {
    render(<OneSignalInit />)
    const mock = makeMockOneSignal({ subId: 'sub-1' })
    await drainQueue(mock)

    const initArg = mock.init.mock.calls[0][0] as {
      promptOptions?: { slidedown?: { prompts?: Array<{ type: string; autoPrompt: boolean }> } }
    }
    // init must carry an explicit push prompt config with autoPrompt exactly false.
    expect(initArg.promptOptions).toBeDefined()
    const prompts = initArg.promptOptions?.slidedown?.prompts
    expect(Array.isArray(prompts)).toBe(true)
    const pushPrompt = prompts?.find((p) => p.type === 'push')
    expect(pushPrompt).toBeDefined()
    expect(pushPrompt?.autoPrompt).toBe(false)
    // And no permission-prompt surface is ever invoked on load.
    expect(mock.Slidedown.promptPush).not.toHaveBeenCalled()
    expect(mock.Notifications.requestPermission).not.toHaveBeenCalled()
  })
})
