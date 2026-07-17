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
})
