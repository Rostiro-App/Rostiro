import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, waitFor, act } from '@testing-library/react'
import PlayerIntelligenceCard from './PlayerIntelligenceCard'

const BASE_PLAYER = {
  playerId: '4984',
  name: 'Josh Allen',
  position: 'QB',
  nflTeam: 'BUF',
  injuryStatus: null,
  adpSleeper: 1,
  depthChartOrder: 1,
  depthChartPosition: 'QB',
}

function mockFetchOnce(body: unknown) {
  global.fetch = vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve(body) })) as never
}

async function openCard(playerId = '4984') {
  render(<PlayerIntelligenceCard />)
  act(() => {
    window.dispatchEvent(new CustomEvent('rostiro:open-player-card', { detail: { playerId } }))
  })
  await waitFor(() => expect(screen.getByText('Josh Allen')).toBeTruthy())
}

describe('PlayerIntelligenceCard — P3.5-1 cross-platform closure', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('PROOF: mixed Sleeper and ESPN league states both render, each with their own platform badge and league name', async () => {
    mockFetchOnce({
      player: BASE_PLAYER,
      availability: [
        { leagueId: 'cl-sleeper', leagueName: 'Testing League', status: 'mine', isStarter: true, platform: 'sleeper', freshness: 'fresh', actionCapability: 'none', unresolvedSourcePlayerId: null, externalLeagueId: 'sleeper-league-1' },
        { leagueId: 'cl-espn', leagueName: 'Example ESPN League', status: 'free_agent', isStarter: false, platform: 'espn', freshness: 'fresh', actionCapability: 'none', unresolvedSourcePlayerId: null, externalLeagueId: '123456789' },
      ],
      usage: null,
      context: null,
    })
    await openCard()

    expect(screen.getByText('SLEEPER')).toBeTruthy()
    expect(screen.getByText('Testing League')).toBeTruthy()
    expect(screen.getByText('ESPN')).toBeTruthy()
    expect(screen.getByText('Example ESPN League')).toBeTruthy()
    expect(screen.getByText('On your roster · STARTING')).toBeTruthy()
    expect(screen.getByText('Free agent')).toBeTruthy()
  })

  it('PROOF: a fresh league shows no freshness note; a stale league shows the honest stale warning', async () => {
    mockFetchOnce({
      player: BASE_PLAYER,
      availability: [
        { leagueId: 'cl-fresh', leagueName: 'Fresh League', status: 'mine', isStarter: false, platform: 'sleeper', freshness: 'fresh', actionCapability: 'none', unresolvedSourcePlayerId: null, externalLeagueId: 'sl-1' },
        { leagueId: 'cl-stale', leagueName: 'Stale League', status: 'mine', isStarter: false, platform: 'sleeper', freshness: 'stale', actionCapability: 'none', unresolvedSourcePlayerId: null, externalLeagueId: 'sl-2' },
      ],
      usage: null,
      context: null,
    })
    await openCard()

    expect(screen.getByText(/Stale — may not reflect recent moves/)).toBeTruthy()
    // The fresh league's row must not also show a stale warning.
    expect(screen.getAllByText(/Stale — may not reflect recent moves/)).toHaveLength(1)
  })

  it('PROOF: advice-only (no real deep link) renders plain text, never a clickable button', async () => {
    mockFetchOnce({
      player: BASE_PLAYER,
      availability: [
        { leagueId: 'cl-1', leagueName: 'No Link League', status: 'unknown', isStarter: false, platform: 'sleeper', freshness: 'unavailable', actionCapability: 'none', unresolvedSourcePlayerId: null, externalLeagueId: '' },
      ],
      usage: null,
      context: null,
    })
    await openCard()

    expect(screen.getByText('Advice only')).toBeTruthy()
    expect(screen.queryByRole('link', { name: /Review on/ })).toBeNull()
  })

  it('PROOF: a real externalLeagueId renders a real clickable link with the correct "Review on {Platform}" label and href', async () => {
    mockFetchOnce({
      player: BASE_PLAYER,
      availability: [
        { leagueId: 'cl-espn', leagueName: 'Real ESPN League', status: 'free_agent', isStarter: false, platform: 'espn', freshness: 'fresh', actionCapability: 'none', unresolvedSourcePlayerId: null, externalLeagueId: '123456789' },
      ],
      usage: null,
      context: null,
    })
    await openCard()

    const link = screen.getByRole('link', { name: 'Review on ESPN →' }) as HTMLAnchorElement
    expect(link).toBeTruthy()
    expect(link.href).toBe('https://fantasy.espn.com/football/league?leagueId=123456789')
    expect(screen.queryByText('Advice only')).toBeNull()
  })

  it('PROOF: unknown status and unavailable freshness are both visibly surfaced, never hidden', async () => {
    mockFetchOnce({
      player: BASE_PLAYER,
      availability: [
        { leagueId: 'cl-1', leagueName: 'Unclear League', status: 'unknown', isStarter: false, platform: 'sleeper', freshness: 'unavailable', actionCapability: 'none', unresolvedSourcePlayerId: null, externalLeagueId: 'sl-3' },
      ],
      usage: null,
      context: null,
    })
    await openCard()

    expect(screen.getByText('Unknown')).toBeTruthy()
    expect(screen.getByText('Data unavailable right now')).toBeTruthy()
  })

  it('PROOF: an unresolved identity in one league is surfaced honestly, never silently dropped', async () => {
    mockFetchOnce({
      player: BASE_PLAYER,
      availability: [
        { leagueId: 'cl-1', leagueName: 'Unresolved League', status: 'mine', isStarter: false, platform: 'sleeper', freshness: 'fresh', actionCapability: 'none', unresolvedSourcePlayerId: '4046', externalLeagueId: 'sl-4' },
      ],
      usage: null,
      context: null,
    })
    await openCard()

    // The league itself still renders (never dropped)...
    expect(screen.getByText('Unresolved League')).toBeTruthy()
    // ...and carries an honest, human note — never the raw source player ID.
    expect(screen.getByText('Not yet cross-linked in this league')).toBeTruthy()
    expect(screen.queryByText('4046')).toBeNull()
  })

  it('PROOF: a raw canonical UUID is never rendered as visible text anywhere in the card', async () => {
    const CANONICAL_UUID = '550e8400-e29b-41d4-a716-446655440000'
    mockFetchOnce({
      player: { ...BASE_PLAYER, canonicalPlayerId: CANONICAL_UUID },
      availability: [
        { leagueId: CANONICAL_UUID, leagueName: 'Some League', status: 'mine', isStarter: false, platform: 'sleeper', freshness: 'fresh', actionCapability: 'none', unresolvedSourcePlayerId: null, externalLeagueId: 'sl-5' },
      ],
      usage: null,
      context: null,
    })
    await openCard()

    expect(screen.queryByText(CANONICAL_UUID)).toBeNull()
    expect(document.body.textContent).not.toContain(CANONICAL_UUID)
  })

  it('PROOF: a legacy raw Sleeper ID ("4984") still drives the same fetch and renders successfully through the component', async () => {
    mockFetchOnce({
      player: BASE_PLAYER,
      availability: [],
      usage: null,
      context: null,
    })
    render(<PlayerIntelligenceCard />)
    act(() => {
      window.dispatchEvent(new CustomEvent('rostiro:open-player-card', { detail: { playerId: '4984' } }))
    })
    await waitFor(() => expect(screen.getByText('Josh Allen')).toBeTruthy())

    expect(global.fetch).toHaveBeenCalledWith('/api/players/4984/intelligence')
    expect(screen.getByText('No connected leagues to check.')).toBeTruthy()
  })
})
