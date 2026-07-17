import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import YahooConnectionPanel from './YahooConnectionPanel'

// Packet 02, Workstream G: each connection state renders the correct
// message and controls; the interface never claims write access; a
// partial sync shows a recovery action; disconnect requires confirmation.

function mockFetchOnce(response: unknown, ok = true, status = 200) {
  vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({
    ok,
    status,
    json: () => Promise.resolve(response),
  } as Response)))
}

describe('YahooConnectionPanel', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('renders nothing when Yahoo was never connected and no leagues exist', async () => {
    mockFetchOnce({ connected: false, needsReconnect: false, leagueCount: 0, failedCount: 0 })
    const { container } = render(<YahooConnectionPanel onChanged={() => {}} />)
    await waitFor(() => expect(container.firstChild).toBeNull())
  })

  it('shows a connected, fully-synced summary with Resync and Disconnect controls', async () => {
    mockFetchOnce({ connected: true, needsReconnect: false, leagueCount: 3, failedCount: 0 })
    render(<YahooConnectionPanel onChanged={() => {}} />)
    await waitFor(() => expect(screen.getByText('3 leagues synced')).toBeTruthy())
    expect(screen.getByText('Resync Yahoo')).toBeTruthy()
    expect(screen.getByText('Disconnect Yahoo')).toBeTruthy()
    // Never claims write access anywhere in this panel's copy.
    expect(screen.getByText(/Read-only/)).toBeTruthy()
  })

  it('shows a partial-sync state with the failed count and a resync recovery action', async () => {
    mockFetchOnce({ connected: true, needsReconnect: false, leagueCount: 5, failedCount: 2 })
    render(<YahooConnectionPanel onChanged={() => {}} />)
    await waitFor(() => expect(screen.getByText('3 synced, 2 failed')).toBeTruthy())
    expect(screen.getByText('Resync Yahoo')).toBeTruthy()
  })

  it('shows a reconnect-required state with a Reconnect control instead of Resync', async () => {
    mockFetchOnce({ connected: false, needsReconnect: true, leagueCount: 2, failedCount: 0 })
    render(<YahooConnectionPanel onChanged={() => {}} />)
    await waitFor(() => expect(screen.getByText('Reconnect required')).toBeTruthy())
    expect(screen.getByText('Reconnect Yahoo')).toBeTruthy()
    expect(screen.queryByText('Resync Yahoo')).toBeNull()
  })

  it('requires a confirmation step before disconnecting', async () => {
    mockFetchOnce({ connected: true, needsReconnect: false, leagueCount: 1, failedCount: 0 })
    render(<YahooConnectionPanel onChanged={() => {}} />)
    await waitFor(() => expect(screen.getByText('Disconnect Yahoo')).toBeTruthy())

    // Clicking once shows a confirm/cancel pair, not an immediate DELETE.
    fireEvent.click(screen.getByText('Disconnect Yahoo'))
    expect(screen.getByText('Confirm')).toBeTruthy()
    expect(screen.getByText('Cancel')).toBeTruthy()
  })

  it('shows the last successful sync time and a View Yahoo Leagues control when leagues exist', async () => {
    mockFetchOnce({ connected: true, needsReconnect: false, leagueCount: 2, failedCount: 0, lastSyncedAt: '2026-07-17T12:00:00.000Z' })
    render(<YahooConnectionPanel onChanged={() => {}} />)
    await waitFor(() => expect(screen.getByText(/Last synced/)).toBeTruthy())
    expect(screen.getByText('View Yahoo Leagues')).toBeTruthy()
  })

  it('does not show a last-synced line when nothing has synced yet', async () => {
    mockFetchOnce({ connected: false, needsReconnect: true, leagueCount: 0, failedCount: 0, lastSyncedAt: null })
    render(<YahooConnectionPanel onChanged={() => {}} />)
    await waitFor(() => expect(screen.getByText('Reconnect required')).toBeTruthy())
    expect(screen.queryByText(/Last synced/)).toBeNull()
    expect(screen.queryByText('View Yahoo Leagues')).toBeNull()
  })

  it('shows a safe error and preserves the retry path when disconnect fails — never silently ignored', async () => {
    const fetchMock = vi.fn((_url: string, init?: RequestInit) => {
      if (init?.method === 'DELETE') {
        return Promise.resolve({ ok: false, status: 500, json: () => Promise.resolve({ error: 'db down' }) } as Response)
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ connected: true, needsReconnect: false, leagueCount: 1, failedCount: 0 }),
      } as Response)
    })
    vi.stubGlobal('fetch', fetchMock)
    const onChanged = vi.fn()

    render(<YahooConnectionPanel onChanged={onChanged} />)
    await waitFor(() => expect(screen.getByText('Disconnect Yahoo')).toBeTruthy())

    fireEvent.click(screen.getByText('Disconnect Yahoo'))
    fireEvent.click(screen.getByText('Confirm'))

    await waitFor(() => expect(screen.getByText('Could not disconnect Yahoo — try again.')).toBeTruthy())
    // Retry path preserved: Confirm/Cancel are still there, not collapsed
    // back to the single "Disconnect Yahoo" button.
    expect(screen.getByText('Confirm')).toBeTruthy()
    expect(screen.getByText('Cancel')).toBeTruthy()
    // A failed disconnect must never be treated as if it succeeded.
    expect(onChanged).not.toHaveBeenCalled()
  })
})
