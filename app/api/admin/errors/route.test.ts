import { describe, it, expect, vi } from 'vitest'

vi.mock('@/lib/adminAuth', () => ({ requireAdmin: vi.fn() }))
vi.mock('@/lib/supabase', () => ({
  createAdminClient: vi.fn(() => ({
    from: () => ({
      select: () => ({
        order: () => ({
          limit: () => Promise.resolve({ data: [{ id: '1', source: 's', message: 'm', stack: null, context: null, created_at: 'now' }], error: null }),
        }),
      }),
    }),
  })),
}))

import { GET } from './route'
import { requireAdmin } from '@/lib/adminAuth'

describe('GET /api/admin/errors', () => {
  it('rejects with 403 when there is no session (regression test: no longer 401-then-plan-check)', async () => {
    vi.mocked(requireAdmin).mockResolvedValue(null)
    const res = await GET()
    expect(res.status).toBe(403)
  })

  it('rejects a non-admin user regardless of plan (requireAdmin already encodes that, this proves the route trusts it)', async () => {
    vi.mocked(requireAdmin).mockResolvedValue(null)
    const res = await GET()
    expect(res.status).toBe(403)
  })

  it('allows the configured admin and returns the error log', async () => {
    vi.mocked(requireAdmin).mockResolvedValue({ id: 'admin-id' } as never)
    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.errors).toHaveLength(1)
  })
})
