// Packet 3.5, P3.5-2 — Pulse Visual-State Closure. Behavioral regression
// tests for app/(dashboard)/pulse/page.tsx across every state the
// platform-neutral /api/pulse response can produce. Prefers behavioral
// assertions (what the founder reads on screen) over implementation detail.
//
// PulsePage fires three fetches on mount: /api/system/status (drives the
// state relabels + totalLeagueCount), /api/pulse (the item + coverage
// feed under test), and — only in game_day/film_room — /api/live/status or
// /api/film-room. Every test here holds rostiroState at 'standard' so only
// the first two fire; the fetch mock routes by URL and tolerates any other
// URL (e.g. fire-and-forget /api/telemetry) with a benign empty body.

import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, waitFor, act, fireEvent, cleanup } from '@testing-library/react'
import PulsePage from './page'
import type { PulseItem, PulseItemType, PulsePriority, Platform } from '@/types'

// ─── Fixture builders ────────────────────────────────────────────────────────

type CoverageStatus =
  | 'included_fresh'
  | 'included_stale'
  | 'unavailable'
  | 'unsupported'
  | 'approval_pending'
  | 'failed'

interface CoverageEntry {
  connectedLeagueId: string
  leagueName: string
  platform: string
  status: CoverageStatus
  reason: string | null
}

interface PulseResponse {
  items: PulseItem[]
  leagueCount: number
  doneToday: number
  estMinutes: number
  firstName: string | null
  persistent: boolean
  coverage: CoverageEntry[]
}

function fullPulse(p: Partial<PulseResponse>): PulseResponse {
  return {
    items: [],
    leagueCount: 0,
    doneToday: 0,
    estMinutes: 0,
    firstName: null,
    persistent: false,
    coverage: [],
    ...p,
  }
}

function coverage(
  id: string,
  leagueName: string,
  platform: string,
  status: CoverageStatus,
  reason: string | null = null
): CoverageEntry {
  return { connectedLeagueId: id, leagueName, platform, status, reason }
}

interface AffectedLeagueInput {
  leagueId: string
  leagueName: string
  platform: Platform
  freshness?: 'fresh' | 'stale' | 'unavailable' | 'unsupported' | 'approval_pending'
  actionCapability?: 'none' | 'lineup' | 'waiver'
  canonicalPlayerId?: string | null
  providerPlayerId?: string | null
  status?: 'mine' | 'rostered_elsewhere' | 'free_agent' | 'waivers' | 'unknown' | null
}

function item(overrides: Partial<PulseItem> & { affectedLeagues: AffectedLeagueInput[] }): PulseItem {
  const first = overrides.affectedLeagues[0]
  return {
    id: overrides.id ?? `item-${Math.random().toString(36).slice(2)}`,
    userId: 'user-1',
    type: (overrides.type ?? 'roster_grade') as PulseItemType,
    priority: (overrides.priority ?? 'info') as PulsePriority,
    headline: overrides.headline ?? 'A headline',
    reasoning: overrides.reasoning ?? 'Some reasoning.',
    affectedLeagues: overrides.affectedLeagues,
    deadline: overrides.deadline ?? null,
    actionUrl: overrides.actionUrl ?? null,
    platform: overrides.platform ?? first?.platform ?? null,
    isDismissed: false,
    status: 'open',
    createdAt: overrides.createdAt ?? '2026-07-18T12:00:00.000Z',
  }
}

// ─── Fetch harness ───────────────────────────────────────────────────────────

interface SystemStatus {
  rostiroState: string
  liveScores: unknown[]
  scoresGated: boolean
  leagues: unknown[]
  playoffTier: string
}

const DEFAULT_STATUS: SystemStatus = {
  rostiroState: 'standard',
  liveScores: [],
  scoresGated: false,
  leagues: [],
  playoffTier: 'none',
}

function okJson(body: unknown) {
  return Promise.resolve({ ok: true, json: () => Promise.resolve(body) })
}

// Installs a URL-routing fetch mock. `pulse` may be a single response or a
// queue: the first /api/pulse call gets pulse[0], every subsequent call gets
// the next (and sticks on the last) — this is what lets a retry test return
// a different body the second time.
function installFetch(opts: {
  pulse: Partial<PulseResponse> | Partial<PulseResponse>[]
  pulseOk?: boolean
  status?: Partial<SystemStatus>
}) {
  const queue = (Array.isArray(opts.pulse) ? opts.pulse : [opts.pulse]).map(fullPulse)
  let pulseCall = 0
  const status = { ...DEFAULT_STATUS, ...opts.status }

  global.fetch = vi.fn((input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : input.toString()
    if (url === '/api/system/status') return okJson(status)
    if (url === '/api/pulse') {
      if (opts.pulseOk === false) return Promise.resolve({ ok: false, json: () => Promise.resolve({}) })
      const idx = Math.min(pulseCall, queue.length - 1)
      pulseCall += 1
      return okJson(queue[idx])
    }
    // /api/telemetry and any other fire-and-forget call
    return okJson({})
  }) as never
}

async function renderPulse() {
  render(<PulsePage />)
  // Let the mount fetches resolve so we leave the loading skeleton.
  await waitFor(() => {
    expect(screen.queryByText('Checking your leagues…')).toBeNull()
  })
}

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

// ═══════════════════════════════════════════════════════════════════════════
// NEW BEHAVIOR (P3.5-2) — these must fail against the pre-P3.5-2 page.
// ═══════════════════════════════════════════════════════════════════════════

describe('PulsePage — P3.5-2 new state behavior', () => {
  it('PROOF (D): total coverage failure never says "Nothing needs you right now"', async () => {
    installFetch({
      pulse: {
        items: [],
        leagueCount: 2,
        coverage: [
          coverage('cl-espn', 'Test ESPN League', 'espn', 'failed', 'Snapshot query failed'),
          coverage('cl-espn2', 'Second ESPN League', 'espn', 'unavailable', 'No snapshot yet'),
        ],
      },
    })
    await renderPulse()

    // Not the healthy empty-state copy.
    expect(screen.queryByText('Nothing needs you right now.')).toBeNull()
    // An explicit unavailable/error framing instead (surfaced in both the
    // header subtext and the body state, hence getAllByText).
    expect(screen.getAllByText(/couldn.t check your leagues/i).length).toBeGreaterThan(0)
  })

  it('PROOF (D): total coverage failure with a transient cause offers a retry that re-fetches and recovers', async () => {
    installFetch({
      pulse: [
        {
          items: [],
          leagueCount: 1,
          coverage: [coverage('cl-espn', 'Test ESPN League', 'espn', 'failed', 'Snapshot query failed')],
        },
        {
          items: [
            item({
              id: 'rg-1',
              type: 'roster_grade',
              headline: 'Test ESPN League — your roster grades 82',
              affectedLeagues: [{ leagueId: 'cl-espn', leagueName: 'Test ESPN League', platform: 'espn', freshness: 'fresh', actionCapability: 'none' }],
            }),
          ],
          leagueCount: 1,
          coverage: [coverage('cl-espn', 'Test ESPN League', 'espn', 'included_fresh')],
        },
      ],
    })
    await renderPulse()

    const retry = screen.getByRole('button', { name: /try again/i })
    expect(retry).toBeTruthy()

    await act(async () => {
      fireEvent.click(retry)
    })

    await waitFor(() => expect(screen.getByText('Test ESPN League — your roster grades 82')).toBeTruthy())
    expect(screen.queryByText(/couldn.t check your leagues/i)).toBeNull()
  })

  it('PROOF (G): a Yahoo-only approval-pending account does not look healthy-empty and does not look broken', async () => {
    installFetch({
      pulse: {
        items: [],
        leagueCount: 1,
        coverage: [coverage('cl-yh', 'My Yahoo League', 'yahoo', 'approval_pending', "No intelligence adapter for platform 'yahoo'")],
      },
    })
    await renderPulse()

    expect(screen.queryByText('Nothing needs you right now.')).toBeNull()
    // Honest pending-approval language, surfaced somewhere on the page.
    expect(screen.getAllByText(/pending platform approval/i).length).toBeGreaterThan(0)
    // Approval-pending is structural, not transient — no misleading retry.
    expect(screen.queryByRole('button', { name: /try again/i })).toBeNull()
  })

  it('PROOF (A): during load, the misleading "No leagues connected yet" empty message is not shown', async () => {
    // Hold the pulse fetch open so we can assert on the loading frame.
    let resolvePulse: (v: unknown) => void = () => {}
    const pending = new Promise((r) => { resolvePulse = r })
    global.fetch = vi.fn((input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString()
      if (url === '/api/system/status') return okJson(DEFAULT_STATUS)
      if (url === '/api/pulse') return pending.then(() => ({ ok: true, json: () => Promise.resolve(fullPulse({ leagueCount: 0 })) }))
      return okJson({})
    }) as never

    render(<PulsePage />)
    // While still loading, the empty-state copy must not be asserted as truth.
    expect(screen.queryByText('No leagues connected yet')).toBeNull()
    expect(screen.getByText('Checking your leagues…')).toBeTruthy()

    await act(async () => {
      resolvePulse(null)
      await pending
    })
  })

  it('PROOF (C): partial coverage with real items keeps the items visible and flags the set as partial', async () => {
    installFetch({
      pulse: {
        items: [
          item({
            id: 'rg-espn',
            type: 'roster_grade',
            headline: 'Test ESPN League — your roster grades 74',
            affectedLeagues: [{ leagueId: 'cl-espn', leagueName: 'Test ESPN League', platform: 'espn', freshness: 'fresh', actionCapability: 'none' }],
          }),
        ],
        leagueCount: 2,
        coverage: [
          coverage('cl-espn', 'Test ESPN League', 'espn', 'included_fresh'),
          coverage('cl-sl', 'Sleeper Dynasty', 'sleeper', 'failed', 'Sleeper API 500'),
        ],
      },
    })
    await renderPulse()

    // The valid item is still shown — one provider's failure never blanks it.
    expect(screen.getByText('Test ESPN League — your roster grades 74')).toBeTruthy()
    // And the result is explicitly flagged as incomplete coverage.
    expect(screen.getByText(/coverage incomplete/i)).toBeTruthy()
  })

  it('PROOF (Section 4): the coverage summary reports honest evaluated/fresh/problem counts', async () => {
    installFetch({
      pulse: {
        items: [
          item({
            id: 'rg-1',
            headline: 'League One — your roster grades 90',
            affectedLeagues: [{ leagueId: 'cl-1', leagueName: 'League One', platform: 'espn', freshness: 'fresh', actionCapability: 'none' }],
          }),
        ],
        leagueCount: 3,
        coverage: [
          coverage('cl-1', 'League One', 'espn', 'included_fresh'),
          coverage('cl-2', 'League Two', 'sleeper', 'included_stale'),
          coverage('cl-3', 'League Three', 'espn', 'failed', 'boom'),
        ],
      },
    })
    await renderPulse()

    // "1 of 3 leagues up to date" — fresh count over total.
    expect(screen.getByText(/1 of 3 leagues up to date/i)).toBeTruthy()
    // Stale and unavailable are both counted, not swept under the rug.
    expect(screen.getByText(/1 stale/i)).toBeTruthy()
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// REGRESSION — existing behavior characterized (must not break under P3.5-2).
// These pass against the current page; they lock in the honest states that
// already work so the closure can't silently undo them.
// ═══════════════════════════════════════════════════════════════════════════

describe('PulsePage — P3.5-2 regression (existing honest states)', () => {
  it('PROOF (B): a fully healthy empty state reads as calm "all clear", never as unavailable', async () => {
    installFetch({
      pulse: {
        items: [],
        leagueCount: 2,
        coverage: [
          coverage('cl-1', 'League One', 'sleeper', 'included_fresh'),
          coverage('cl-2', 'League Two', 'espn', 'included_fresh'),
        ],
      },
    })
    await renderPulse()

    expect(screen.getByText('Nothing needs you right now.')).toBeTruthy()
    expect(screen.getByText('All clear across 2 leagues')).toBeTruthy()
    // No unavailable framing, and no coverage clutter when everything is fresh.
    expect(screen.queryByText(/couldn.t check your leagues/i)).toBeNull()
    expect(screen.queryByText(/up to date/i)).toBeNull()
  })

  it('PROOF (E): mixed Sleeper + ESPN items both render as equal, platform-attributed cards', async () => {
    installFetch({
      pulse: {
        items: [
          item({
            id: 'sl-1',
            type: 'roster_grade',
            headline: 'Sleeper Dynasty — your roster grades 88',
            affectedLeagues: [{ leagueId: 'cl-sl', leagueName: 'Sleeper Dynasty', platform: 'sleeper', freshness: 'fresh', actionCapability: 'none' }],
          }),
          item({
            id: 'es-1',
            type: 'roster_grade',
            headline: 'Test ESPN League — your roster grades 79',
            affectedLeagues: [{ leagueId: 'cl-es', leagueName: 'Test ESPN League', platform: 'espn', freshness: 'fresh', actionCapability: 'none' }],
          }),
        ],
        leagueCount: 2,
        coverage: [
          coverage('cl-sl', 'Sleeper Dynasty', 'sleeper', 'included_fresh'),
          coverage('cl-es', 'Test ESPN League', 'espn', 'included_fresh'),
        ],
      },
    })
    await renderPulse()

    expect(screen.getByText('Sleeper Dynasty — your roster grades 88')).toBeTruthy()
    expect(screen.getByText('Test ESPN League — your roster grades 79')).toBeTruthy()
    // Both are ordinary sibling cards — no provider is elevated by branding.
    expect(screen.getAllByRole('article')).toHaveLength(2)
    // Each carries its own platform attribution in the meta line.
    expect(screen.getByText(/·\s*SLEEPER/)).toBeTruthy()
    expect(screen.getByText(/·\s*ESPN/)).toBeTruthy()
  })

  it('PROOF (C): one provider failing never blanks another provider’s surviving item', async () => {
    installFetch({
      pulse: {
        items: [
          item({
            id: 'es-1',
            type: 'roster_grade',
            headline: 'Test ESPN League — your roster grades 79',
            affectedLeagues: [{ leagueId: 'cl-es', leagueName: 'Test ESPN League', platform: 'espn', freshness: 'fresh', actionCapability: 'none' }],
          }),
        ],
        leagueCount: 2,
        coverage: [
          coverage('cl-es', 'Test ESPN League', 'espn', 'included_fresh'),
          coverage('cl-sl', 'Sleeper Dynasty', 'sleeper', 'failed', 'Sleeper API 500'),
        ],
      },
    })
    await renderPulse()

    // The healthy provider's item survives...
    expect(screen.getByText('Test ESPN League — your roster grades 79')).toBeTruthy()
    // ...and the failed provider is named honestly in the coverage summary.
    expect(screen.getByText(/Sleeper Dynasty \(Sleeper\) — temporarily unavailable/)).toBeTruthy()
  })

  it('PROOF (F): an item on a stale league stays visible and is clearly labeled stale, never as current', async () => {
    installFetch({
      pulse: {
        items: [
          item({
            id: 'st-1',
            type: 'lineup_decision',
            headline: 'Confirm your flex in Old League',
            affectedLeagues: [{ leagueId: 'cl-old', leagueName: 'Old League', platform: 'sleeper', freshness: 'stale', actionCapability: 'none' }],
          }),
        ],
        leagueCount: 1,
        coverage: [coverage('cl-old', 'Old League', 'sleeper', 'included_stale')],
      },
    })
    await renderPulse()

    // Item is still shown (last known good), and unmistakably flagged stale.
    expect(screen.getByText('Confirm your flex in Old League')).toBeTruthy()
    expect(screen.getByText(/Stale — may not reflect recent moves/)).toBeTruthy()
  })

  it('PROOF (F/G): coverage chips use honest per-status language for stale/unsupported/pending/failed/unavailable', async () => {
    installFetch({
      pulse: {
        items: [
          item({
            id: 'ok-1',
            headline: 'Healthy League — your roster grades 91',
            affectedLeagues: [{ leagueId: 'cl-ok', leagueName: 'Healthy League', platform: 'espn', freshness: 'fresh', actionCapability: 'none' }],
          }),
        ],
        leagueCount: 6,
        coverage: [
          coverage('cl-ok', 'Healthy League', 'espn', 'included_fresh'),
          coverage('cl-st', 'Stale League', 'sleeper', 'included_stale'),
          coverage('cl-un', 'Unsupported League', 'sleeper', 'unsupported'),
          coverage('cl-yh', 'Yahoo League', 'yahoo', 'approval_pending'),
          coverage('cl-fa', 'Broken League', 'espn', 'failed', 'boom'),
          coverage('cl-na', 'New League', 'espn', 'unavailable'),
        ],
      },
    })
    await renderPulse()

    expect(screen.getByText(/Stale League \(Sleeper\) — stale/)).toBeTruthy()
    expect(screen.getByText(/Unsupported League \(Sleeper\) — not supported yet/)).toBeTruthy()
    expect(screen.getByText(/Yahoo League \(Yahoo\) — pending platform approval/)).toBeTruthy()
    expect(screen.getByText(/Broken League \(ESPN\) — temporarily unavailable/)).toBeTruthy()
    expect(screen.getByText(/New League \(ESPN\) — not synced yet/)).toBeTruthy()
  })

  it('PROOF (H): an unresolved player identity is flagged honestly, and no raw provider/canonical IDs render', async () => {
    const CANONICAL_UUID = '550e8400-e29b-41d4-a716-446655440000'
    installFetch({
      pulse: {
        items: [
          item({
            id: 'unresolved-1',
            type: 'waiver_alert',
            headline: 'A hot free agent is available in Test ESPN League',
            affectedLeagues: [{ leagueId: 'cl-es', leagueName: 'Test ESPN League', platform: 'espn', freshness: 'fresh', actionCapability: 'none', providerPlayerId: '99887', canonicalPlayerId: null, status: 'free_agent' }],
          }),
          item({
            id: 'resolved-1',
            type: 'roster_grade',
            headline: 'Resolved League — your roster grades 80',
            affectedLeagues: [{ leagueId: 'cl-r', leagueName: 'Resolved League', platform: 'sleeper', freshness: 'fresh', actionCapability: 'none', providerPlayerId: '4046', canonicalPlayerId: CANONICAL_UUID, status: 'mine' }],
          }),
        ],
        leagueCount: 2,
        coverage: [
          coverage('cl-es', 'Test ESPN League', 'espn', 'included_fresh'),
          coverage('cl-r', 'Resolved League', 'sleeper', 'included_fresh'),
        ],
      },
    })
    await renderPulse()

    expect(screen.getByText('Not yet cross-linked across your other leagues')).toBeTruthy()
    // No raw identifiers of any kind leak into the DOM text.
    expect(document.body.textContent).not.toContain('99887')
    expect(document.body.textContent).not.toContain('4046')
    expect(document.body.textContent).not.toContain(CANONICAL_UUID)
  })

  it('PROOF (Section 3): an ESPN waiver_alert renders a real "Review on ESPN →" link with a safe external target', async () => {
    installFetch({
      pulse: {
        items: [
          item({
            id: 'waiver-espn',
            type: 'waiver_alert',
            headline: 'Puka Nacua is available in Test ESPN League',
            reasoning: 'Confirmed via ESPN’s real waiver/free-agent data.',
            affectedLeagues: [{ leagueId: 'cl-es', leagueName: 'Test ESPN League', platform: 'espn', freshness: 'fresh', actionCapability: 'waiver', canonicalPlayerId: 'canon-1', providerPlayerId: '12345', status: 'waivers' }],
            actionUrl: 'https://fantasy.espn.com/football/players/add?leagueId=111111',
            platform: 'espn',
          }),
        ],
        leagueCount: 1,
        coverage: [coverage('cl-es', 'Test ESPN League', 'espn', 'included_fresh')],
      },
    })
    await renderPulse()

    const link = screen.getByRole('link', { name: 'Review on ESPN →' }) as HTMLAnchorElement
    expect(link.getAttribute('href')).toBe('https://fantasy.espn.com/football/players/add?leagueId=111111')
    expect(link.getAttribute('target')).toBe('_blank')
    expect(link.getAttribute('rel')).toBe('noopener noreferrer')
    // Not mislabeled as advice-only when a real link exists.
    expect(screen.queryByText('Advice only')).toBeNull()
  })

  it('PROOF (Section 3): an advice-only item renders plain text, never a clickable link or button', async () => {
    installFetch({
      pulse: {
        items: [
          item({
            id: 'advice-1',
            type: 'injury_alert',
            headline: 'Injury update in Sleeper Dynasty',
            affectedLeagues: [{ leagueId: 'cl-sl', leagueName: 'Sleeper Dynasty', platform: 'sleeper', freshness: 'fresh', actionCapability: 'none' }],
            actionUrl: null,
          }),
        ],
        leagueCount: 1,
        coverage: [coverage('cl-sl', 'Sleeper Dynasty', 'sleeper', 'included_fresh')],
      },
    })
    await renderPulse()

    expect(screen.getByText('Advice only')).toBeTruthy()
    expect(screen.queryByRole('link', { name: /advice only/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /advice only/i })).toBeNull()
    expect(screen.queryByRole('link', { name: /review on/i })).toBeNull()
  })

  it('PROOF (Section 7): cached (persistent) and live (non-persistent) responses render the same item content', async () => {
    const theItem = item({
      id: 'consistent-1',
      type: 'roster_grade',
      headline: 'Consistent Headline',
      reasoning: 'Consistent reasoning here.',
      affectedLeagues: [{ leagueId: 'cl-1', leagueName: 'A League', platform: 'sleeper', freshness: 'fresh', actionCapability: 'none' }],
    })

    // Live path (persistent: false) — action buttons are withheld.
    installFetch({ pulse: { items: [theItem], leagueCount: 1, persistent: false, coverage: [coverage('cl-1', 'A League', 'sleeper', 'included_fresh')] } })
    await renderPulse()
    expect(screen.getByText('Consistent Headline')).toBeTruthy()
    expect(screen.getByText('Consistent reasoning here.')).toBeTruthy()
    expect(screen.queryByRole('button', { name: /done/i })).toBeNull()

    cleanup()
    vi.restoreAllMocks()

    // Cached path (persistent: true) — identical content, plus mutate actions.
    installFetch({ pulse: { items: [theItem], leagueCount: 1, persistent: true, coverage: [coverage('cl-1', 'A League', 'sleeper', 'included_fresh')] } })
    await renderPulse()
    expect(screen.getByText('Consistent Headline')).toBeTruthy()
    expect(screen.getByText('Consistent reasoning here.')).toBeTruthy()
    expect(screen.getByRole('button', { name: /done/i })).toBeTruthy()
  })

  it('PROOF (Section 5): long league names and long headlines render in full, never dropped', async () => {
    const LONG_HEADLINE = 'This is an extraordinarily long Pulse headline that keeps going and going to be sure nothing clips or drops it in the default balanced layout at any viewport'
    const LONG_LEAGUE = 'The Extremely Long-Winded Dynasty Superleague Championship Invitational Presented By Nobody In Particular'
    installFetch({
      pulse: {
        items: [
          item({
            id: 'long-1',
            type: 'roster_grade',
            headline: LONG_HEADLINE,
            affectedLeagues: [{ leagueId: 'cl-long', leagueName: LONG_LEAGUE, platform: 'espn', freshness: 'fresh', actionCapability: 'none' }],
          }),
        ],
        leagueCount: 1,
        coverage: [coverage('cl-long', LONG_LEAGUE, 'espn', 'included_fresh')],
      },
    })
    await renderPulse()

    expect(screen.getByText(LONG_HEADLINE)).toBeTruthy()
    // League name is uppercased in the meta line; assert the full text is present.
    expect(document.body.textContent).toContain(LONG_LEAGUE.toUpperCase())
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// STATE-CLASSIFICATION CORRECTION — stale is NOT current coverage; coverage
// evidence outranks leagueCount; partial is about coverage, not item count;
// platform-neutral empty copy; honest retry vs review-leagues affordances.
// ═══════════════════════════════════════════════════════════════════════════

describe('PulsePage — state-classification correction', () => {
  it('PROOF (A): all fresh + zero items → calm normal all-clear', async () => {
    installFetch({
      pulse: {
        items: [],
        leagueCount: 2,
        coverage: [
          coverage('cl-1', 'League One', 'sleeper', 'included_fresh'),
          coverage('cl-2', 'League Two', 'espn', 'included_fresh'),
        ],
      },
    })
    await renderPulse()

    expect(screen.getByText('Nothing needs you right now.')).toBeTruthy()
    expect(screen.getByText('All clear across 2 leagues')).toBeTruthy()
    expect(screen.queryByText(/coverage incomplete/i)).toBeNull()
    expect(screen.queryByText(/couldn.t check your leagues/i)).toBeNull()
  })

  it('PROOF (C-degraded): all stale + zero items must NOT say "Nothing needs you right now"', async () => {
    installFetch({
      pulse: {
        items: [],
        leagueCount: 2,
        coverage: [
          coverage('cl-1', 'League One', 'sleeper', 'included_stale'),
          coverage('cl-2', 'League Two', 'espn', 'included_stale'),
        ],
      },
    })
    await renderPulse()

    // Stale-only is a degraded state — the backend suppresses recommendations
    // from stale leagues, so an unqualified all-clear would be a lie.
    expect(screen.queryByText('Nothing needs you right now.')).toBeNull()
    // "recommendations paused" is surfaced in both the header and the body.
    expect(screen.getAllByText(/recommendations paused/i).length).toBeGreaterThan(0)
    // And it is honestly framed as incomplete coverage.
    expect(screen.getByText(/coverage incomplete/i)).toBeTruthy()
  })

  it('PROOF (B): one fresh + one failed + zero items → qualified all-clear that states coverage is incomplete', async () => {
    installFetch({
      pulse: {
        items: [],
        leagueCount: 2,
        coverage: [
          coverage('cl-fresh', 'Fresh League', 'espn', 'included_fresh'),
          coverage('cl-bad', 'Broken League', 'sleeper', 'failed', 'boom'),
        ],
      },
    })
    await renderPulse()

    // Not the unqualified all-clear (would imply every league was current)...
    expect(screen.queryByText('Nothing needs you right now.')).toBeNull()
    // ...a qualified all-clear scoped to the leagues actually checked...
    expect(screen.getAllByText(/nothing needs attention in the .* we could check/i).length).toBeGreaterThan(0)
    // ...and coverage is explicitly incomplete even though there are zero items.
    expect(screen.getByText(/coverage incomplete/i)).toBeTruthy()
  })

  it('PROOF (D): leagueCount 0 WITH a failed coverage entry → degraded state, never NoLeaguesState', async () => {
    installFetch({
      pulse: {
        items: [],
        leagueCount: 0,
        coverage: [coverage('cl-bad', 'Broken League', 'espn', 'failed', 'boom')],
      },
    })
    await renderPulse()

    // Coverage is evidence evaluation was attempted — do not claim "no leagues."
    expect(screen.queryByText('Connect a league to activate Pulse.')).toBeNull()
    expect(screen.getAllByText(/couldn.t check your leagues/i).length).toBeGreaterThan(0)
    // A genuine failure is retryable.
    expect(screen.getByRole('button', { name: /try again/i })).toBeTruthy()
  })

  it('PROOF: true zero leagues + empty coverage → platform-neutral connect copy', async () => {
    installFetch({ pulse: { items: [], leagueCount: 0, coverage: [] } })
    await renderPulse()

    expect(screen.getByText('Connect a league to activate Pulse.')).toBeTruthy()
    // Platform-neutral: never tells anyone to connect a specific platform.
    expect(document.body.textContent).not.toMatch(/Sleeper/i)
    expect(screen.queryByText(/couldn.t check your leagues/i)).toBeNull()
  })

  it('PROOF: an ESPN-only account is never told to connect Sleeper', async () => {
    installFetch({
      pulse: {
        items: [],
        leagueCount: 1,
        coverage: [coverage('cl-espn', 'Example ESPN League', 'espn', 'unavailable', 'No snapshot yet')],
      },
    })
    await renderPulse()

    // Degraded (not synced yet) — honest guidance, and zero mention of Sleeper.
    expect(document.body.textContent).not.toMatch(/Sleeper/i)
    expect(screen.queryByText('Connect a league to activate Pulse.')).toBeNull()
  })

  it('PROOF: a "failed" coverage entry offers a Try again retry', async () => {
    installFetch({
      pulse: {
        items: [],
        leagueCount: 2,
        coverage: [
          coverage('cl-a', 'League A', 'espn', 'failed', 'boom'),
          coverage('cl-b', 'League B', 'espn', 'failed', 'boom2'),
        ],
      },
    })
    await renderPulse()

    expect(screen.getByRole('button', { name: /try again/i })).toBeTruthy()
  })

  it('PROOF: stale-only coverage does NOT claim a retry will refresh it (offers Review leagues, not Try again)', async () => {
    installFetch({
      pulse: {
        items: [],
        leagueCount: 1,
        coverage: [coverage('cl-old', 'Old League', 'sleeper', 'included_stale')],
      },
    })
    await renderPulse()

    // Repeating GET won't force a sync — a retry button here would be dishonest.
    expect(screen.queryByRole('button', { name: /try again/i })).toBeNull()
    // Instead, honest sync guidance.
    const review = screen.getByRole('link', { name: /review leagues/i }) as HTMLAnchorElement
    expect(review.getAttribute('href')).toBe('/leagues')
  })

  it('PROOF: approval-pending and unsupported degraded states have no retry button', async () => {
    // approval_pending
    installFetch({
      pulse: { items: [], leagueCount: 1, coverage: [coverage('cl-yh', 'Yahoo League', 'yahoo', 'approval_pending')] },
    })
    await renderPulse()
    expect(screen.queryByRole('button', { name: /try again/i })).toBeNull()
    expect(screen.queryByText('Nothing needs you right now.')).toBeNull()

    cleanup()
    vi.restoreAllMocks()

    // unsupported
    installFetch({
      pulse: { items: [], leagueCount: 1, coverage: [coverage('cl-u', 'Legacy League', 'sleeper', 'unsupported')] },
    })
    await renderPulse()
    expect(screen.queryByRole('button', { name: /try again/i })).toBeNull()
    expect(screen.queryByRole('link', { name: /review leagues/i })).toBeNull()
    expect(screen.queryByText('Nothing needs you right now.')).toBeNull()
  })

  it('PROOF: mixed-platform items remain visible during a partial-coverage load', async () => {
    installFetch({
      pulse: {
        items: [
          item({ id: 'sl', type: 'roster_grade', headline: 'Sleeper League — your roster grades 88', affectedLeagues: [{ leagueId: 'cl-sl', leagueName: 'Sleeper League', platform: 'sleeper', freshness: 'fresh', actionCapability: 'none' }] }),
          item({ id: 'es', type: 'roster_grade', headline: 'ESPN League — your roster grades 71', affectedLeagues: [{ leagueId: 'cl-es', leagueName: 'ESPN League', platform: 'espn', freshness: 'fresh', actionCapability: 'none' }] }),
        ],
        leagueCount: 3,
        coverage: [
          coverage('cl-sl', 'Sleeper League', 'sleeper', 'included_fresh'),
          coverage('cl-es', 'ESPN League', 'espn', 'included_fresh'),
          coverage('cl-x', 'Down League', 'espn', 'failed', 'boom'),
        ],
      },
    })
    await renderPulse()

    expect(screen.getByText('Sleeper League — your roster grades 88')).toBeTruthy()
    expect(screen.getByText('ESPN League — your roster grades 71')).toBeTruthy()
    expect(screen.getByText(/coverage incomplete/i)).toBeTruthy()
  })
})
