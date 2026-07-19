// P3.5-4C (+ correction): the Settings push UI, tested against a mocked
// lib/pushSubscription so each honest state can be asserted in isolation.

import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import PushNotificationSetting from './PushNotificationSetting'
import * as pushSubscription from '@/lib/pushSubscription'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

function mockState(state: pushSubscription.PushSubscriptionState) {
  vi.spyOn(pushSubscription, 'getPushSubscriptionState').mockReturnValue(state)
  vi.spyOn(pushSubscription, 'getServerPushSubscriptionState').mockReturnValue(state)
  vi.spyOn(pushSubscription, 'subscribePushSubscriptionState').mockImplementation(() => () => {})
}

describe('PushNotificationSetting (P3.5-4C correction)', () => {
  it('initializing: neutral checking copy, no button, never says unsupported', () => {
    mockState('initializing')
    render(<PushNotificationSetting />)
    expect(screen.getByText(/checking notification availability/i)).toBeTruthy()
    expect(screen.queryByRole('button')).toBeNull()
    expect(screen.queryByText(/not supported/i)).toBeNull()
  })

  it('unsupported: no button, no permission request possible', () => {
    mockState('unsupported')
    const request = vi.spyOn(pushSubscription, 'requestPushSubscription').mockResolvedValue(undefined)
    render(<PushNotificationSetting />)
    expect(screen.queryByRole('button')).toBeNull()
    expect(request).not.toHaveBeenCalled()
  })

  it('available: explicit Enable button; mounting alone never requests permission', () => {
    mockState('available')
    const request = vi.spyOn(pushSubscription, 'requestPushSubscription').mockResolvedValue(undefined)
    render(<PushNotificationSetting />)
    expect(screen.getByRole('button', { name: /enable notifications/i })).toBeTruthy()
    expect(request).not.toHaveBeenCalled()
  })

  it('clicking Enable calls requestPushSubscription exactly once', () => {
    mockState('available')
    const request = vi.spyOn(pushSubscription, 'requestPushSubscription').mockResolvedValue(undefined)
    render(<PushNotificationSetting />)
    fireEvent.click(screen.getByRole('button', { name: /enable notifications/i }))
    expect(request).toHaveBeenCalledTimes(1)
  })

  it('requesting: button disabled and labeled, cannot re-fire', () => {
    mockState('requesting')
    const request = vi.spyOn(pushSubscription, 'requestPushSubscription').mockResolvedValue(undefined)
    render(<PushNotificationSetting />)
    const button = screen.getByRole('button', { name: /requesting/i }) as HTMLButtonElement
    expect(button.disabled).toBe(true)
    fireEvent.click(button)
    expect(request).not.toHaveBeenCalled()
  })

  it('subscribed: shows an explicit Disable action wired to disablePushSubscription', () => {
    mockState('subscribed')
    const disable = vi.spyOn(pushSubscription, 'disablePushSubscription').mockResolvedValue(undefined)
    render(<PushNotificationSetting />)
    const button = screen.getByRole('button', { name: /^disable$/i })
    fireEvent.click(button)
    expect(disable).toHaveBeenCalledTimes(1)
  })

  it('renders only fixed copy — no subscription id is ever surfaced in the UI', () => {
    // The component reads a state enum, never the id, so it structurally cannot
    // render one. Assert the subscribed render contains only the known copy.
    mockState('subscribed')
    const { container } = render(<PushNotificationSetting />)
    expect(container.textContent).toContain('Push notifications')
    expect(container.textContent).toContain("You're subscribed on this device.")
    expect(container.textContent).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}/i) // no UUID-like id
  })

  it('disabling: shows an in-flight disabled control', () => {
    mockState('disabling')
    render(<PushNotificationSetting />)
    const button = screen.getByRole('button', { name: /disabling/i }) as HTMLButtonElement
    expect(button.disabled).toBe(true)
  })

  it('disableFailed: honest failure copy with a retry that re-attempts disable', () => {
    mockState('disableFailed')
    const disable = vi.spyOn(pushSubscription, 'disablePushSubscription').mockResolvedValue(undefined)
    render(<PushNotificationSetting />)
    expect(screen.getByText(/couldn't fully turn these off/i)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /try again/i }))
    expect(disable).toHaveBeenCalledTimes(1)
    expect(screen.queryByText(/^enabled$/i)).toBeNull()
  })

  it('denied: clear instructions, no button, never "enabled"', () => {
    mockState('denied')
    render(<PushNotificationSetting />)
    expect(screen.getByText(/blocked in your browser/i)).toBeTruthy()
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('failed: remains usable with a retry that re-attempts enable', () => {
    mockState('failed')
    const request = vi.spyOn(pushSubscription, 'requestPushSubscription').mockResolvedValue(undefined)
    render(<PushNotificationSetting />)
    const button = screen.getByRole('button', { name: /try again/i }) as HTMLButtonElement
    expect(button.disabled).toBe(false)
    fireEvent.click(button)
    expect(request).toHaveBeenCalledTimes(1)
  })

  // TEST C: a distinct initialization failure tells the user to reload the page
  // and shows NO inert subscription "Try again" button (there is nothing to
  // retry — the SDK never started).
  it('initializationFailed: reload-the-page copy, no inert Try again button', () => {
    mockState('initializationFailed' as pushSubscription.PushSubscriptionState)
    const request = vi.spyOn(pushSubscription, 'requestPushSubscription').mockResolvedValue(undefined)
    const disable = vi.spyOn(pushSubscription, 'disablePushSubscription').mockResolvedValue(undefined)
    render(<PushNotificationSetting />)
    expect(screen.getByText(/reload this page/i)).toBeTruthy()
    expect(screen.queryByRole('button')).toBeNull()
    expect(request).not.toHaveBeenCalled()
    expect(disable).not.toHaveBeenCalled()
  })
})
