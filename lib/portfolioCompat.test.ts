import { describe, it, expect } from 'vitest'
import { parseStoredExposureRow, isCanonicalExposureIdentity } from './portfolioCompat'

describe('parseStoredExposureRow — never silently reinterprets old Sleeper IDs as canonical', () => {
  it('a real pre-P3-6 row with no version columns at all (migration not yet applied) defaults to sleeper_raw/v1', () => {
    const parsed = parseStoredExposureRow({ player_id: '4046' })
    expect(parsed).toMatchObject({ schemaVersion: 1, idSpace: 'sleeper_raw', playerId: '4046', isLegacyUnversioned: true })
  })

  it('a row explicitly marked schema_version 1 / sleeper_raw (post-migration backfill) parses the same way', () => {
    const parsed = parseStoredExposureRow({ player_id: '4046', schema_version: 1, player_id_space: 'sleeper_raw' })
    expect(parsed).toMatchObject({ schemaVersion: 1, idSpace: 'sleeper_raw', isLegacyUnversioned: false })
  })

  it('a real P3-6-written row explicitly marked canonical parses as such', () => {
    const parsed = parseStoredExposureRow({ player_id: '3fa85f64-5717-4562-b3fc-2c963f66afa6', schema_version: 2, player_id_space: 'canonical' })
    expect(parsed).toMatchObject({ schemaVersion: 2, idSpace: 'canonical' })
  })

  it('a malformed row claiming a numeric player_id AND canonical space is still parsed as claimed, not second-guessed — isCanonicalExposureIdentity is the trust boundary', () => {
    const parsed = parseStoredExposureRow({ player_id: '4046', schema_version: 2, player_id_space: 'canonical' })
    expect(parsed.idSpace).toBe('canonical')
  })
})

describe('isCanonicalExposureIdentity — the trust boundary a reader must use', () => {
  it('is false for a legacy unversioned row', () => {
    expect(isCanonicalExposureIdentity({ player_id: '4046' })).toBe(false)
  })
  it('is false for an explicit v1/sleeper_raw row', () => {
    expect(isCanonicalExposureIdentity({ player_id: '4046', schema_version: 1, player_id_space: 'sleeper_raw' })).toBe(false)
  })
  it('is true only for schema_version >= 2 AND player_id_space canonical', () => {
    expect(isCanonicalExposureIdentity({ player_id: 'uuid-1', schema_version: 2, player_id_space: 'canonical' })).toBe(true)
  })
  it('is false for an inconsistent row (version 2 but space still sleeper_raw) — never trusts a partial signal', () => {
    expect(isCanonicalExposureIdentity({ player_id: '4046', schema_version: 2, player_id_space: 'sleeper_raw' })).toBe(false)
  })
})
