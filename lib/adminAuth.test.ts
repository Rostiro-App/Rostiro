import { describe, it, expect, vi, afterEach } from 'vitest'

const ADMIN_ID = '11111111-1111-1111-1111-111111111111'
const OTHER_ID = '22222222-2222-2222-2222-222222222222'

function mockSSRClient(user: { id: string } | null) {
  return {
    auth: { getUser: () => Promise.resolve({ data: { user } }) },
  }
}

vi.mock('./supabase', () => ({
  createSSRClient: vi.fn(),
}))

import { createSSRClient } from './supabase'
import { requireAdmin, requireAdminUserId, isAdminUserId } from './adminAuth'

describe('requireAdmin', () => {
  const original = process.env.ADMIN_USER_ID

  afterEach(() => {
    process.env.ADMIN_USER_ID = original
    vi.mocked(createSSRClient).mockReset()
  })

  it('fails closed when ADMIN_USER_ID is not configured', async () => {
    delete process.env.ADMIN_USER_ID
    vi.mocked(createSSRClient).mockResolvedValue(mockSSRClient({ id: ADMIN_ID }) as never)
    expect(await requireAdmin()).toBeNull()
  })

  it('fails closed when ADMIN_USER_ID is malformed (not a UUID)', async () => {
    process.env.ADMIN_USER_ID = 'not-a-real-uuid'
    vi.mocked(createSSRClient).mockResolvedValue(mockSSRClient({ id: 'not-a-real-uuid' }) as never)
    expect(await requireAdmin()).toBeNull()
  })

  it('rejects when there is no authenticated session', async () => {
    process.env.ADMIN_USER_ID = ADMIN_ID
    vi.mocked(createSSRClient).mockResolvedValue(mockSSRClient(null) as never)
    expect(await requireAdmin()).toBeNull()
  })

  it('rejects a real, authenticated, non-admin user (regression test: no plan/email/founding-number bypass)', async () => {
    process.env.ADMIN_USER_ID = ADMIN_ID
    vi.mocked(createSSRClient).mockResolvedValue(mockSSRClient({ id: OTHER_ID }) as never)
    expect(await requireAdmin()).toBeNull()
  })

  it('accepts the configured admin user', async () => {
    process.env.ADMIN_USER_ID = ADMIN_ID
    vi.mocked(createSSRClient).mockResolvedValue(mockSSRClient({ id: ADMIN_ID }) as never)
    const result = await requireAdmin()
    expect(result?.id).toBe(ADMIN_ID)
  })
})

describe('requireAdminUserId', () => {
  const original = process.env.ADMIN_USER_ID

  afterEach(() => {
    process.env.ADMIN_USER_ID = original
  })

  it('throws when ADMIN_USER_ID is not configured', () => {
    delete process.env.ADMIN_USER_ID
    expect(() => requireAdminUserId()).toThrow()
  })

  it('throws when ADMIN_USER_ID is malformed', () => {
    process.env.ADMIN_USER_ID = 'nope'
    expect(() => requireAdminUserId()).toThrow()
  })

  it('returns the configured id when valid', () => {
    process.env.ADMIN_USER_ID = ADMIN_ID
    expect(requireAdminUserId()).toBe(ADMIN_ID)
  })
})

// P3.5-4B: the pure capability check the server layouts use to decide whether
// to mount SimulationPanel. Shares configuredAdminUserId() with requireAdmin()
// so the UI gate and the route's own check can't drift. Returns only booleans;
// never exposes the configured id.
describe('isAdminUserId', () => {
  const original = process.env.ADMIN_USER_ID
  afterEach(() => {
    process.env.ADMIN_USER_ID = original
  })

  it('fails closed (false) when ADMIN_USER_ID is not configured', () => {
    delete process.env.ADMIN_USER_ID
    expect(isAdminUserId(ADMIN_ID)).toBe(false)
  })

  it('fails closed (false) when ADMIN_USER_ID is malformed (not a UUID)', () => {
    process.env.ADMIN_USER_ID = 'not-a-real-uuid'
    expect(isAdminUserId('not-a-real-uuid')).toBe(false)
  })

  it('returns false for a real, authenticated, non-matching user', () => {
    process.env.ADMIN_USER_ID = ADMIN_ID
    expect(isAdminUserId(OTHER_ID)).toBe(false)
  })

  it('returns true only for the exact configured admin user id', () => {
    process.env.ADMIN_USER_ID = ADMIN_ID
    expect(isAdminUserId(ADMIN_ID)).toBe(true)
  })
})
