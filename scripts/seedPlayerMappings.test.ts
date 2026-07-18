import { describe, it, expect, vi } from 'vitest'
import { applyActions } from './seedPlayerMappings.mts'
import type { ExistingMapping, SeedAction } from '../lib/playerMappingSeed'

function mockAdmin() {
  let capturedPayload: Record<string, unknown> | null = null
  const admin = {
    from: vi.fn(() => ({
      update: vi.fn((payload: Record<string, unknown>) => {
        capturedPayload = payload
        return { eq: vi.fn(() => Promise.resolve({ error: null })) }
      }),
    })),
  }
  return { admin, getPayload: () => capturedPayload }
}

function updateTeamAction(newNflTeam: string | null): SeedAction {
  return { type: 'update_team', mappingId: 'm-1', newNflTeam, matchBasis: 'provider_id_reuse' }
}

function existingMapping(overrides: Partial<ExistingMapping> = {}): ExistingMapping {
  return {
    id: 'm-1',
    name: 'Puka Nacua',
    nflTeam: 'LAR',
    position: 'WR',
    espnId: 'e1',
    yahooId: null,
    sleeperId: 's1',
    season: 2026,
    ...overrides,
  }
}

describe('applyActions — update_team — PROOF (P3-11D): teamless_activity_unverified tracks the new team, mapping_basis never upgraded', () => {
  it('null team -> known team clears teamless_activity_unverified', async () => {
    const { admin, getPayload } = mockAdmin()
    const existingById = new Map([['m-1', existingMapping({ nflTeam: null, mappingBasis: 'single_platform' })]])
    await applyActions(admin as never, [updateTeamAction('BUF')], existingById)
    expect(getPayload()).toMatchObject({ nfl_team: 'BUF', teamless_activity_unverified: false })
  })

  it('known team -> null team sets teamless_activity_unverified', async () => {
    const { admin, getPayload } = mockAdmin()
    const existingById = new Map([['m-1', existingMapping({ nflTeam: 'LAR', mappingBasis: 'single_platform' })]])
    await applyActions(admin as never, [updateTeamAction(null)], existingById)
    expect(getPayload()).toMatchObject({ nfl_team: null, teamless_activity_unverified: true })
  })

  it('neither transition writes mapping_basis when the row already has one recorded (single_platform preserved)', async () => {
    const { admin, getPayload } = mockAdmin()
    const existingById = new Map([['m-1', existingMapping({ mappingBasis: 'single_platform' })]])
    await applyActions(admin as never, [updateTeamAction('BUF')], existingById)
    expect(getPayload()).not.toHaveProperty('mapping_basis')
  })

  it('neither transition writes mapping_basis when the row already has one recorded (name_team_unambiguous preserved)', async () => {
    const { admin, getPayload } = mockAdmin()
    const existingById = new Map([['m-1', existingMapping({ mappingBasis: 'name_team_unambiguous' })]])
    await applyActions(admin as never, [updateTeamAction(null)], existingById)
    expect(getPayload()).not.toHaveProperty('mapping_basis')
    // The team-change direction is orthogonal to provenance — this must
    // never be silently upgraded to 'provider_id_reuse' just because this
    // action's own matchBasis says so.
    expect(getPayload()?.mapping_basis).not.toBe('provider_id_reuse')
  })

  it('sets mapping_basis only when the row has no basis recorded yet (legacy/pre-backfill row)', async () => {
    const { admin, getPayload } = mockAdmin()
    const existingById = new Map([['m-1', existingMapping({ mappingBasis: null })]])
    await applyActions(admin as never, [updateTeamAction('BUF')], existingById)
    expect(getPayload()).toMatchObject({ mapping_basis: 'provider_id_reuse', teamless_activity_unverified: false })
  })
})
