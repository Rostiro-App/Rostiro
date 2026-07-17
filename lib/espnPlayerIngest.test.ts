import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mapEspnPlayerEntry } from './espnPlayerIngest'

// Real kona_player_info entries captured live this session (P3-3) —
// genuine NFL players, no sanitization needed (public sports data).
const realAbanikanda = {
  id: 4429202,
  player: {
    id: 4429202,
    fullName: 'Israel Abanikanda',
    firstName: 'Israel',
    lastName: 'Abanikanda',
    defaultPositionId: 2,
    proTeamId: 6,
    injuryStatus: 'ACTIVE',
    ownership: { percentOwned: 0.04, averageDraftPosition: 169.99 },
  },
}
const realNacua = {
  id: 4426515,
  player: {
    id: 4426515,
    fullName: 'Puka Nacua',
    firstName: 'Puka',
    lastName: 'Nacua',
    defaultPositionId: 3,
    proTeamId: 14,
    injuryStatus: 'ACTIVE',
    ownership: { percentOwned: 99.9, averageDraftPosition: 8.2 },
  },
}

describe('mapEspnPlayerEntry — real captured shapes', () => {
  it('maps a real rostered player with position/team resolved via the shared ESPN maps', () => {
    const mapped = mapEspnPlayerEntry(realAbanikanda)
    expect(mapped).toMatchObject({
      playerId: '4429202',
      platform: 'espn',
      name: 'Israel Abanikanda',
      position: 'RB',
      // P3-4B: proTeamId 6 is DAL, confirmed via a real, complete capture
      // of all 32 team defenses' unambiguous names — the earlier P3-3 map
      // (which asserted 6 = NYJ from this same player, circularly, before
      // the map itself was independently verified) had this wrong.
      nflTeam: 'DAL',
      injuryStatus: 'ACTIVE',
      ownershipPct: 0.04,
      adpEspn: 169.99,
    })
  })

  it('maps a real WR correctly (position id 3)', () => {
    const mapped = mapEspnPlayerEntry(realNacua)
    expect(mapped?.position).toBe('WR')
    expect(mapped?.nflTeam).toBe('LAR')
  })

  it('never drops an entry with no player.id — returns null so the caller can count it, not silently skip', () => {
    expect(mapEspnPlayerEntry({ player: { fullName: 'No ID Player' } })).toBeNull()
    expect(mapEspnPlayerEntry({})).toBeNull()
  })

  it('reports nflTeam as null (never a placeholder string) for an unmapped/unsigned proTeamId', () => {
    const unsigned = { id: 999, player: { id: 999, fullName: 'Unsigned Guy', defaultPositionId: 2, proTeamId: 0 } }
    const mapped = mapEspnPlayerEntry(unsigned)
    expect(mapped?.nflTeam).toBeNull()
  })

  it('reports position as null (not a fabricated guess) for an unrecognized position id', () => {
    const oddPosition = { id: 1000, player: { id: 1000, fullName: 'Odd Position', defaultPositionId: 999, proTeamId: 6 } }
    const mapped = mapEspnPlayerEntry(oddPosition)
    expect(mapped?.position).toBeNull()
  })
})

describe('ingestEspnPlayers — pagination + skip accounting', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('paginates via getEspnAllPlayers and reports skipped/no-id entries honestly', async () => {
    vi.doMock('@/lib/espn', () => ({
      getEspnAllPlayers: vi.fn(() =>
        Promise.resolve({
          players: [realAbanikanda, realNacua, { player: { fullName: 'No ID' } }],
          pagesFetched: 2,
          hitMaxPages: false,
        })
      ),
    }))

    const { ingestEspnPlayers } = await import('./espnPlayerIngest')
    const result = await ingestEspnPlayers('12345', { espnS2: 's2', swid: 'swid' })

    expect(result.candidates).toHaveLength(2)
    expect(result.skippedNoId).toBe(1)
    expect(result.totalRawEntries).toBe(3)
    expect(result.pagesFetched).toBe(2)
  })

  it('surfaces hitMaxPages from the underlying fetch rather than hiding a truncated ingest', async () => {
    vi.doMock('@/lib/espn', () => ({
      getEspnAllPlayers: vi.fn(() => Promise.resolve({ players: [], pagesFetched: 20, hitMaxPages: true })),
    }))
    const { ingestEspnPlayers } = await import('./espnPlayerIngest')
    const result = await ingestEspnPlayers('12345', { espnS2: 's2', swid: 'swid' })
    expect(result.hitMaxPages).toBe(true)
  })
})
