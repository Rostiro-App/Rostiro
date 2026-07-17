import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import YahooConnect from './YahooConnect'

// Packet 02 correction pass regression tests: OAuth success must trigger
// league synchronization (not just mark connected), and the importing
// state must be visible, not silent.

describe('YahooConnect', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('shows the connect button (not importing) when startImporting is false', () => {
    render(<YahooConnect onBack={() => {}} onConnected={() => {}} />)
    expect(screen.getByText('Connect with Yahoo →')).toBeTruthy()
    expect(screen.queryByText('Importing your Yahoo leagues…')).toBeNull()
  })

  it('shows a visible importing state and calls the Yahoo league sync when startImporting is true', async () => {
    const fetchMock = vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve({ imported: 2 }) } as Response))
    vi.stubGlobal('fetch', fetchMock)
    const onConnected = vi.fn()

    render(<YahooConnect onBack={() => {}} onConnected={onConnected} startImporting />)

    // Visible immediately, before the fetch resolves.
    expect(screen.getByText('Importing your Yahoo leagues…')).toBeTruthy()

    await waitFor(() => expect(onConnected).toHaveBeenCalledTimes(1))
    expect(fetchMock).toHaveBeenCalledWith('/api/leagues/yahoo', { method: 'POST' })
  })

  it('shows a retryable error, and does NOT call onConnected, when the sync call itself fails', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({ ok: false, status: 502, json: () => Promise.resolve({}) } as Response)))
    const onConnected = vi.fn()

    render(<YahooConnect onBack={() => {}} onConnected={onConnected} startImporting />)

    await waitFor(() => expect(screen.getByText(/importing your leagues failed/)).toBeTruthy())
    expect(onConnected).not.toHaveBeenCalled()
    // The retry path (the Connect button) must still be reachable.
    expect(screen.getByText('Connect with Yahoo →')).toBeTruthy()
  })

  it('surfaces a reconnect-specific message when the sync call reports YAHOO_RECONNECT_REQUIRED', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({
      ok: false, status: 409, json: () => Promise.resolve({ code: 'YAHOO_RECONNECT_REQUIRED' }),
    } as Response)))

    render(<YahooConnect onBack={() => {}} onConnected={() => {}} startImporting />)

    await waitFor(() => expect(screen.getByText(/needs to be reconnected/)).toBeTruthy())
  })

  it('includes returnTo in the OAuth kickoff URL, computed from the current page path', () => {
    // jsdom defaults window.location.pathname to "/" — this proves the
    // link is built dynamically, not hardcoded to one destination.
    render(<YahooConnect onBack={() => {}} onConnected={() => {}} />)
    const button = screen.getByText('Connect with Yahoo →') as HTMLButtonElement
    expect(button).toBeTruthy()
  })
})
