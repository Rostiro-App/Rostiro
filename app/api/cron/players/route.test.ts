import { describe, it, expect, vi, afterEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/supabase', () => ({ createAdminClient: vi.fn(() => { throw new Error('should never be reached when auth fails') }) }))
vi.mock('@/lib/sleeper', () => ({ getSleeperPlayers: vi.fn(() => { throw new Error('should never be reached when auth fails') }), SEASON: 2026 }))
vi.mock('@/lib/nflverseUsage', () => ({ fetchPlayerUsageSnapshots: vi.fn() }))
vi.mock('@/lib/cronHeartbeat', () => ({ recordCronRun: vi.fn() }))

import { GET } from './route'
import { recordCronRun } from '@/lib/cronHeartbeat'

function req(authHeader?: string): NextRequest {
  const headers = new Headers()
  if (authHeader !== undefined) headers.set('authorization', authHeader)
  return new NextRequest('http://localhost/api/cron/players', { headers })
}

describe('GET /api/cron/players — auth boundary (representative cron route)', () => {
  const original = process.env.CRON_SECRET

  afterEach(() => {
    process.env.CRON_SECRET = original
    vi.mocked(recordCronRun).mockReset()
  })

  it('rejects and never calls recordCronRun when CRON_SECRET is unset', async () => {
    delete process.env.CRON_SECRET
    const res = await GET(req('Bearer undefined'))
    expect(res.status).toBe(401)
    expect(recordCronRun).not.toHaveBeenCalled()
  })

  it('rejects a wrong secret and never calls recordCronRun', async () => {
    process.env.CRON_SECRET = 'real-secret'
    const res = await GET(req('Bearer wrong'))
    expect(res.status).toBe(401)
    expect(recordCronRun).not.toHaveBeenCalled()
  })

  it('a valid Vercel-style request with the correct secret passes the auth gate and proceeds to recordCronRun', async () => {
    process.env.CRON_SECRET = 'real-secret'
    vi.mocked(recordCronRun).mockResolvedValue(undefined as never)
    // The route body itself will throw past this point (mocked
    // getSleeperPlayers throws) — that's fine, this test only proves the
    // auth gate passed and execution reached recordCronRun, not that the
    // full sync succeeds (unrelated to this packet's scope).
    const res = await GET(req('Bearer real-secret'))
    expect(recordCronRun).toHaveBeenCalledWith('players')
    expect(res.status).toBe(500) // the mocked getSleeperPlayers throw, caught by the route's own try/catch
  })
})
