// P3.5-4A push-init reliability + P3.5-4C single-owner handoff coverage.
//
// The real SDK is never contacted. OneSignalInit's only side effects are to
// push an init callback onto window.OneSignalDeferred and, on success, hand
// the resolved SDK to the sync owner (lib/pushSubscription, mocked here).
// These tests render the component, then simulate the CDN SDK draining the
// queue. Preserved P3.5-4A safety properties: the queued callback NEVER
// rejects (an unhandled rejection is the historical "SDK timeout" console
// error), init runs at most once per page lifecycle, and no permission prompt
// is ever requested on load. New P3.5-4C property: a successful init hands off
// to setOneSignalSdk and OneSignalInit itself performs no server reporting.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'

vi.mock('@/lib/pushSubscription', () => ({
  setOneSignalSdk: vi.fn(),
  markUnsupported: vi.fn(),
  markFailed: vi.fn(),
  markInitializationFailed: vi.fn(),
}))

import OneSignalInit from './OneSignalInit'
import { setOneSignalSdk, markUnsupported, markFailed, markInitializationFailed } from '@/lib/pushSubscription'

interface MockOneSignal {
  init: ReturnType<typeof vi.fn>
  User: { PushSubscription: { id: string | null; optedIn: boolean; addEventListener: ReturnType<typeof vi.fn> } }
  Notifications: { requestPermission: ReturnType<typeof vi.fn> }
  Slidedown: { promptPush: ReturnType<typeof vi.fn> }
}

function makeMockOneSignal(opts: { init?: () => Promise<void> } = {}): MockOneSignal {
  return {
    init: vi.fn(opts.init ?? (() => Promise.resolve())),
    User: { PushSubscription: { id: null, optedIn: false, addEventListener: vi.fn() } },
    Notifications: { requestPermission: vi.fn() },
    Slidedown: { promptPush: vi.fn() },
  }
}

function queuedCallbacks() {
  return (window.OneSignalDeferred ?? []) as unknown as Array<(os: MockOneSignal) => Promise<void>>
}

async function drainQueue(mock: MockOneSignal) {
  for (const cb of queuedCallbacks()) await cb(mock)
}

beforeEach(() => {
  vi.stubEnv('NEXT_PUBLIC_ONESIGNAL_APP_ID', 'test-app-id')
  delete (window as unknown as { OneSignalDeferred?: unknown }).OneSignalDeferred
  delete (window as unknown as { __rostiroPushInitStarted?: unknown }).__rostiroPushInitStarted
})

afterEach(() => {
  cleanup()
  vi.unstubAllEnvs()
  vi.clearAllMocks()
})

describe('OneSignalInit — init reliability + single-owner handoff', () => {
  it('renders nothing and never throws (push is optional, never blocks the app)', () => {
    const { container } = render(<OneSignalInit />)
    expect(container.innerHTML).toBe('')
  })

  it('successful init hands the SDK to the single sync owner (no direct reporting here)', async () => {
    render(<OneSignalInit />)
    const mock = makeMockOneSignal()
    await drainQueue(mock)

    expect(mock.init).toHaveBeenCalledTimes(1)
    expect(setOneSignalSdk).toHaveBeenCalledTimes(1)
    expect(setOneSignalSdk).toHaveBeenCalledWith(mock)
    // OneSignalInit no longer registers its own change listener.
    expect(mock.User.PushSubscription.addEventListener).not.toHaveBeenCalled()
  })

  // TEST C: an init rejection is a DISTINCT initialization failure — not the
  // retryable subscription-registration failure. It reports markInitializationFailed
  // (so Settings can tell the user to reload), never markFailed, and never rejects.
  it('PROOF: an SDK init timeout/rejection is caught — the callback never rejects, and it reports a DISTINCT init failure', async () => {
    render(<OneSignalInit />)
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const mock = makeMockOneSignal({ init: () => Promise.reject(new Error('OneSignal init timed out')) })

    const cb = queuedCallbacks()[0]
    await expect(cb(mock)).resolves.toBeUndefined()
    expect(markInitializationFailed).toHaveBeenCalledTimes(1)
    expect(markFailed).not.toHaveBeenCalled()
    expect(setOneSignalSdk).not.toHaveBeenCalled()
    expect(warn).toHaveBeenCalledTimes(1)
  })

  it('blocked/never-loaded SDK: the callback is simply queued and never runs — no error, app usable', () => {
    render(<OneSignalInit />)
    expect(queuedCallbacks()).toHaveLength(1)
  })

  it('missing app ID exits quietly, marks unsupported, and queues nothing', () => {
    vi.stubEnv('NEXT_PUBLIC_ONESIGNAL_APP_ID', '')
    render(<OneSignalInit />)
    expect(window.OneSignalDeferred ?? []).toHaveLength(0)
    expect(markUnsupported).toHaveBeenCalledTimes(1)
  })

  it('duplicate mounts / Strict Mode: init is attempted at most once per page lifecycle', async () => {
    render(<OneSignalInit />)
    cleanup()
    render(<OneSignalInit />)
    expect(queuedCallbacks()).toHaveLength(1)
    const mock = makeMockOneSignal()
    await drainQueue(mock)
    expect(mock.init).toHaveBeenCalledTimes(1)
  })

  it('no automatic permission prompt on load: init disables autoPrompt and no prompt API is invoked', async () => {
    render(<OneSignalInit />)
    const mock = makeMockOneSignal()
    await drainQueue(mock)

    const initArg = mock.init.mock.calls[0][0] as {
      promptOptions?: { slidedown?: { prompts?: Array<{ type: string; autoPrompt: boolean }> } }
    }
    expect(initArg.promptOptions).toBeDefined()
    const prompts = initArg.promptOptions?.slidedown?.prompts
    expect(Array.isArray(prompts)).toBe(true)
    const pushPrompt = prompts?.find((p) => p.type === 'push')
    expect(pushPrompt?.autoPrompt).toBe(false)
    expect(mock.Slidedown.promptPush).not.toHaveBeenCalled()
    expect(mock.Notifications.requestPermission).not.toHaveBeenCalled()
  })
})
