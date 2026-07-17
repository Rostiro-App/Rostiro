import { describe, it, expect, vi } from 'vitest'
import { checkRateLimit, getClientIp } from './rateLimit'

function mockAdmin(response: { data: unknown; error: unknown }) {
  return { rpc: vi.fn(() => Promise.resolve(response)) } as unknown as Parameters<typeof checkRateLimit>[0]
}

describe('checkRateLimit', () => {
  it('allows a request below the limit', async () => {
    const admin = mockAdmin({ data: [{ allowed: true, remaining: 4 }], error: null })
    const result = await checkRateLimit(admin, 'key', 5, 60)
    expect(result).toEqual({ allowed: true, remaining: 4, reason: undefined })
  })

  it('allows a request exactly at the limit boundary (RPC reports the last allowed slot)', async () => {
    const admin = mockAdmin({ data: [{ allowed: true, remaining: 0 }], error: null })
    const result = await checkRateLimit(admin, 'key', 5, 60)
    expect(result.allowed).toBe(true)
    expect(result.remaining).toBe(0)
  })

  it('rejects a request over the limit with reason "rate_limited"', async () => {
    const admin = mockAdmin({ data: [{ allowed: false, remaining: 0 }], error: null })
    const result = await checkRateLimit(admin, 'key', 5, 60)
    expect(result).toEqual({ allowed: false, remaining: 0, reason: 'rate_limited' })
  })

  it('fails CLOSED (not open) on an RPC error — regression test for the v1 fail-open default', async () => {
    const admin = mockAdmin({ data: null, error: { message: 'connection failed' } })
    const result = await checkRateLimit(admin, 'key', 5, 60)
    expect(result).toEqual({ allowed: false, remaining: 0, reason: 'service_unavailable' })
  })

  it('fails closed when the RPC returns no rows', async () => {
    const admin = mockAdmin({ data: [], error: null })
    const result = await checkRateLimit(admin, 'key', 5, 60)
    expect(result.allowed).toBe(false)
    expect(result.reason).toBe('service_unavailable')
  })

  it('scopes independent route prefixes to independent keys (no shared allowance)', async () => {
    const rpc = vi.fn(() => Promise.resolve({ data: [{ allowed: true, remaining: 4 }], error: null }))
    const admin = { rpc } as unknown as Parameters<typeof checkRateLimit>[0]
    await checkRateLimit(admin, 'draft-recommend:1.2.3.4', 5, 60)
    await checkRateLimit(admin, 'log-error:1.2.3.4', 5, 60)
    expect(rpc).toHaveBeenNthCalledWith(1, 'increment_rate_limit', expect.objectContaining({ p_rate_key: 'draft-recommend:1.2.3.4' }))
    expect(rpc).toHaveBeenNthCalledWith(2, 'increment_rate_limit', expect.objectContaining({ p_rate_key: 'log-error:1.2.3.4' }))
  })
})

describe('getClientIp', () => {
  it('prefers x-forwarded-for, taking the first entry', () => {
    const req = new Request('http://localhost', { headers: { 'x-forwarded-for': '1.2.3.4, 5.6.7.8' } })
    expect(getClientIp(req)).toBe('1.2.3.4')
  })

  it('falls back to x-real-ip', () => {
    const req = new Request('http://localhost', { headers: { 'x-real-ip': '9.9.9.9' } })
    expect(getClientIp(req)).toBe('9.9.9.9')
  })

  it('falls back to "unknown" when neither header is present', () => {
    const req = new Request('http://localhost')
    expect(getClientIp(req)).toBe('unknown')
  })
})
