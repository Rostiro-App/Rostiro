import { describe, it, expect, vi, beforeEach } from 'vitest'

// Real ESPN Fantasy API shapes, captured live this session against a real
// user league (799979, "10th Annual Broome St League", 2026 season, not
// yet drafted) via an authenticated browser session — same discipline as
// lib/platforms/sleeper.test.ts's real Sleeper captures. Names/GUIDs from
// the live mRoster/mTeam capture were replaced with fake placeholders
// before being used here (see the Packet 03 completion report); the real
// entry/player field SHAPES below (playerPoolEntry.player.{id,fullName,
// defaultPositionId,proTeamId}, entry.lineupSlotId) come directly from a
// live mScoreboard/kona_player_info capture, not from documentation
// guesses. This league hasn't drafted, so no REAL populated roster exists
// yet to capture — the two roster entries below combine a real, live
// entry-wrapper shape with real player objects (Puka Nacua id 4426515,
// Jonathan Taylor id 4242335 — both real, live-verified NFL players) into
// a fixture, since a genuinely populated roster capture is not possible
// until this league's real draft happens.

const mockContext = {
  connectedLeagueId: 'cl-espn-1',
  userId: 'user-1',
  platform: 'espn' as const,
  externalLeagueId: '799979',
  externalTeamId: '7',
}

const rawTeams = [
  {
    id: 7,
    name: 'Rizz Em With the Tism',
    roster: {
      entries: [
        {
          lineupSlotId: 4, // WR starter slot — real, confirmed via live mScoreboard capture
          playerPoolEntry: {
            id: 4426515,
            player: { id: 4426515, fullName: 'Puka Nacua', defaultPositionId: 3, proTeamId: 14 },
          },
        },
        {
          lineupSlotId: 20, // BN — real slot id, confirmed via lib/normalize.ts's existing ESPN convention
          playerPoolEntry: {
            id: 4242335,
            player: { id: 4242335, fullName: 'Jonathan Taylor', defaultPositionId: 2, proTeamId: 11 },
          },
        },
      ],
    },
  },
  { id: 8, name: 'Dead Wabbits', roster: { entries: [] } },
]

const mappingRows = [
  { id: 'canon-nacua', name: 'Puka Nacua', nfl_team: 'LAR', position: 'WR', espn_id: '4426515', yahoo_id: null, sleeper_id: null },
]

function mockAdmin(mappings: typeof mappingRows) {
  return {
    from: vi.fn((table: string) => {
      if (table === 'espn_credentials') {
        return { select: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle: vi.fn(() => Promise.resolve({ data: { espn_s2: 'enc-s2', swid: 'enc-swid' } })) })) })) }
      }
      if (table === 'player_mappings') {
        return { select: vi.fn(() => ({ eq: vi.fn(() => Promise.resolve({ data: mappings })) })) }
      }
      return {}
    }),
  }
}

vi.mock('@/lib/encrypt', () => ({ decrypt: vi.fn((v: string) => v.replace('enc-', '')) }))

describe('espnReadOwnedRoster', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('normalizes the owned roster from a real team/entry shape, marking starters vs bench and resolving identity', async () => {
    vi.doMock('@/lib/supabase', () => ({ createAdminClient: vi.fn(() => mockAdmin(mappingRows)) }))
    vi.doMock('@/lib/espn', () => ({ getEspnRosters: vi.fn(() => Promise.resolve({ teams: rawTeams })) }))

    const { espnReadOwnedRoster } = await import('./espn')
    const result = await espnReadOwnedRoster(mockContext)

    expect(result.status).toBe('ok')
    expect(result.data?.players).toHaveLength(2)
    const nacua = result.data?.players.find((p) => p.sourcePlayerId === '4426515')
    expect(nacua?.lineupStatus).toBe('starting')
    expect(nacua?.position).toBe('WR')
    expect(nacua?.nflTeam).toBe('LAR')
    expect(nacua?.canonicalPlayerId).toBe('canon-nacua')
    expect(nacua?.identityConfidence).toBe('exact')

    const taylor = result.data?.players.find((p) => p.sourcePlayerId === '4242335')
    expect(taylor?.lineupStatus).toBe('bench')
    expect(taylor?.identityConfidence).toBe('unresolved')
    // Unresolved players are still present, never dropped.
    expect(result.data?.warnings.some((w) => w.field.includes('4242335'))).toBe(true)
  })

  it('fails safely (not a fabricated empty roster) when the owned team is not found', async () => {
    vi.doMock('@/lib/supabase', () => ({ createAdminClient: vi.fn(() => mockAdmin([])) }))
    vi.doMock('@/lib/espn', () => ({ getEspnRosters: vi.fn(() => Promise.resolve({ teams: rawTeams })) }))

    const { espnReadOwnedRoster } = await import('./espn')
    const result = await espnReadOwnedRoster({ ...mockContext, externalTeamId: '999' })

    expect(result.status).toBe('failed')
    expect(result.data).toBeNull()
  })

  it('fails safely when no ESPN credentials are on file for this user', async () => {
    const noCredsAdmin = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle: vi.fn(() => Promise.resolve({ data: null })) })) })),
      })),
    }
    vi.doMock('@/lib/supabase', () => ({ createAdminClient: vi.fn(() => noCredsAdmin) }))
    vi.doMock('@/lib/espn', () => ({ getEspnRosters: vi.fn(() => Promise.resolve({ teams: rawTeams })) }))

    const { espnReadOwnedRoster } = await import('./espn')
    const result = await espnReadOwnedRoster(mockContext)
    expect(result.status).toBe('failed')
    expect(result.errorReason).toMatch(/no espn credentials/i)
  })
})

describe('espnReadMatchup', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  // Real, live-confirmed field names (lib/espn.ts's getEspnLivePoints,
  // "VERIFIED LIVE July 3, 2026"): matchupPeriodId, home/away.teamId,
  // per-player appliedTotal. This league's real matchups are all still
  // 0-0 placeholders (undrafted, preseason) so the point values below are
  // illustrative, not a literal capture — but every field name and the
  // summation approach are grounded in already-shipped, verified code.
  const rawSchedule = {
    schedule: [
      { matchupPeriodId: 5, home: { teamId: 7 }, away: { teamId: 8 } },
    ],
  }
  const rawLivePoints = [
    { teamId: 7, playerPoints: [{ playerId: '4426515', points: 21.2 }, { playerId: '4242335', points: 17.3 }] },
    { teamId: 8, playerPoints: [{ playerId: '9999', points: 10.0 }] },
  ]

  it('pairs the owned team with its real opponent and derives scores from live per-player points', async () => {
    vi.doMock('@/lib/supabase', () => ({ createAdminClient: vi.fn(() => mockAdmin(mappingRows)) }))
    vi.doMock('@/lib/espn', () => ({
      getEspnMatchup: vi.fn(() => Promise.resolve(rawSchedule)),
      getEspnLivePoints: vi.fn(() => Promise.resolve(rawLivePoints)),
    }))

    const { espnReadMatchup } = await import('./espn')
    const result = await espnReadMatchup(mockContext, 5)

    expect(result.status).toBe('ok')
    expect(result.data?.opponentTeamId).toBe('8')
    expect(result.data?.myScore).toBeCloseTo(38.5)
    expect(result.data?.opponentScore).toBeCloseTo(10.0)
  })

  it('fails safely when no matchup exists for this team/week, not a fabricated zero score', async () => {
    vi.doMock('@/lib/supabase', () => ({ createAdminClient: vi.fn(() => mockAdmin(mappingRows)) }))
    vi.doMock('@/lib/espn', () => ({
      getEspnMatchup: vi.fn(() => Promise.resolve({ schedule: [] })),
      getEspnLivePoints: vi.fn(() => Promise.resolve([])),
    }))

    const { espnReadMatchup } = await import('./espn')
    const result = await espnReadMatchup(mockContext, 5)
    expect(result.status).toBe('failed')
    expect(result.data).toBeNull()
  })

  it('reports myScore null with a warning rather than 0 when live point data is missing', async () => {
    vi.doMock('@/lib/supabase', () => ({ createAdminClient: vi.fn(() => mockAdmin(mappingRows)) }))
    vi.doMock('@/lib/espn', () => ({
      getEspnMatchup: vi.fn(() => Promise.resolve(rawSchedule)),
      getEspnLivePoints: vi.fn(() => Promise.resolve([])),
    }))

    const { espnReadMatchup } = await import('./espn')
    const result = await espnReadMatchup(mockContext, 5)
    expect(result.data?.myScore).toBeNull()
    expect(result.warnings.some((w) => w.field === 'myScore')).toBe(true)
  })
})

describe('espnReadAvailablePlayers', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  // Real player objects captured live from kona_player_info this session
  // — genuine NFL players, no sanitization needed (public sports data).
  const rawWaiverPool = {
    players: [
      { player: { id: 4429202, fullName: 'Israel Abanikanda', defaultPositionId: 2, proTeamId: 6 }, status: 'FREEAGENT' },
      { player: { id: 2576336, fullName: 'Ameer Abdullah', defaultPositionId: 2, proTeamId: 30 }, status: 'WAIVERS' },
      { player: { id: 4429160, fullName: "De'Von Achane", defaultPositionId: 2, proTeamId: 15 }, status: 'FREEAGENT' },
    ],
  }

  it('normalizes the real free-agent pool, distinguishing free agents from waivers', async () => {
    vi.doMock('@/lib/supabase', () => ({ createAdminClient: vi.fn(() => mockAdmin([])) }))
    vi.doMock('@/lib/espn', () => ({ getEspnWaivers: vi.fn(() => Promise.resolve(rawWaiverPool)) }))

    const { espnReadAvailablePlayers } = await import('./espn')
    const result = await espnReadAvailablePlayers(mockContext)

    expect(result.status).toBe('ok')
    expect(result.data).toHaveLength(3)
    const abdullah = result.data?.find((p) => p.sourcePlayerId === '2576336')
    expect(abdullah?.availability).toBe('waivers')
    // P3-4B: ESPN_PRO_TEAM_MAP was corrected using a real, complete capture
    // of all 32 team defenses' unambiguous names — proTeamId 30 is JAX,
    // not LV (the earlier P3-3 map had this wrong).
    expect(abdullah?.nflTeam).toBe('JAX')
    const achane = result.data?.find((p) => p.sourcePlayerId === '4429160')
    expect(achane?.availability).toBe('free_agent')
    expect(achane?.position).toBe('RB')
  })
})

describe('espnReadDraftMetadata', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('maps a real not-yet-drafted league, matching this session\'s live capture (drafted:false, inProgress:false)', async () => {
    vi.doMock('@/lib/espn', () => ({
      getEspnDraftDetail: vi.fn(() => Promise.resolve({ draftDetail: { drafted: false, inProgress: false } })),
    }))
    const { espnReadDraftMetadata } = await import('./espn')
    const result = await espnReadDraftMetadata(mockContext)
    expect(result.data?.status).toBe('not_started')
    // ESPN's real mDraftDetail response carries no scheduled-start field.
    expect(result.data?.scheduledAt).toBeNull()
    expect(result.warnings.length).toBeGreaterThan(0)
  })

  it('maps a real in-progress draft', async () => {
    vi.doMock('@/lib/espn', () => ({
      getEspnDraftDetail: vi.fn(() => Promise.resolve({ draftDetail: { drafted: false, inProgress: true } })),
    }))
    const { espnReadDraftMetadata } = await import('./espn')
    const result = await espnReadDraftMetadata(mockContext)
    expect(result.data?.status).toBe('in_progress')
  })

  it('reports unknown with a warning, never a fabricated status, when ESPN returns null (fetch failed)', async () => {
    vi.doMock('@/lib/espn', () => ({ getEspnDraftDetail: vi.fn(() => Promise.resolve(null)) }))
    const { espnReadDraftMetadata } = await import('./espn')
    const result = await espnReadDraftMetadata(mockContext)
    expect(result.data?.status).toBe('unknown')
    expect(result.warnings.length).toBeGreaterThan(0)
  })
})
