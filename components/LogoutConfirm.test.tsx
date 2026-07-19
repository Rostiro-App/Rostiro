// P3.5-4C correction: logout lifecycle wiring. Signing out must remove THIS
// browser's push subscription association before the session is destroyed,
// without blocking sign-out. Here we prove the confirm's submit path calls the
// device-unregister helper and still performs the native form submit (which
// preserves the server route's 303 redirect).

import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react'

vi.mock('@/lib/pushSubscription', () => ({
  unregisterCurrentDeviceForLogout: vi.fn().mockResolvedValue(undefined),
}))

import LogoutConfirm from './LogoutConfirm'
import { unregisterCurrentDeviceForLogout } from '@/lib/pushSubscription'

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('LogoutConfirm push logout lifecycle (P3.5-4C)', () => {
  it('unregisters the current device, then performs the native form submit', async () => {
    // jsdom does not implement HTMLFormElement.submit — stub it so we can
    // observe it without a "Not implemented" error and without navigating.
    const submitSpy = vi
      .spyOn(HTMLFormElement.prototype, 'submit')
      .mockImplementation(() => {})

    render(<LogoutConfirm trigger={(open) => <button onClick={open}>Open</button>} />)
    fireEvent.click(screen.getByText('Open'))
    fireEvent.click(screen.getByRole('button', { name: /log out/i }))

    await waitFor(() => expect(unregisterCurrentDeviceForLogout).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(submitSpy).toHaveBeenCalledTimes(1))
  })
})
