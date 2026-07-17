import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/errorLog', () => ({ logAppError: vi.fn(() => Promise.resolve()) }))
vi.mock('@/lib/supabase', () => ({ createAdminClient: vi.fn(() => ({})) }))
vi.mock('@/lib/rateLimit', () => ({
  checkRateLimit: vi.fn(() => Promise.resolve({ allowed: true, remaining: 9 })),
  getClientIp: vi.fn(() => '1.2.3.4'),
}))

import { POST } from './route'
import { logAppError } from '@/lib/errorLog'
import { checkRateLimit } from '@/lib/rateLimit'

function postReq(body: unknown, headers: Record<string, string> = {}) {
  const json = typeof body === 'string' ? body : JSON.stringify(body)
  return new Request('http://localhost/api/system/log-error', {
    method: 'POST',
    body: json,
    headers: { 'content-type': 'application/json', ...headers },
  })
}

describe('POST /api/system/log-error', () => {
  beforeEach(() => {
    vi.mocked(checkRateLimit).mockReset().mockResolvedValue({ allowed: true, remaining: 9 })
    vi.mocked(logAppError).mockReset().mockResolvedValue(undefined)
  })

  it('accepts a valid small report', async () => {
    const res = await POST(postReq({ source: 'client', message: 'Something broke' }))
    expect(res.status).toBe(200)
    expect(logAppError).toHaveBeenCalledWith('client', expect.any(Error), undefined, undefined)
  })

  it('rejects an invalid body (fails schema validation)', async () => {
    const res = await POST(postReq({ source: '', message: '' }))
    expect(res.status).toBe(400)
    expect(logAppError).not.toHaveBeenCalled()
  })

  it('rejects an oversized request via Content-Length before parsing', async () => {
    const res = await POST(postReq({ source: 'client', message: 'ok' }, { 'content-length': String(20 * 1024) }))
    expect(res.status).toBe(413)
    expect(logAppError).not.toHaveBeenCalled()
  })

  it('rejects an oversized serialized context even under the body-size header check', async () => {
    const bigContext: Record<string, string> = {}
    bigContext.blob = 'x'.repeat(9 * 1024) // exceeds MAX_CONTEXT_BYTES (8KB) alone
    const res = await POST(postReq({ source: 'client', message: 'ok', context: bigContext }))
    expect(res.status).toBe(413)
    expect(logAppError).not.toHaveBeenCalled()
  })

  it('rejects context with too many top-level keys', async () => {
    const manyKeys: Record<string, number> = {}
    for (let i = 0; i < 30; i++) manyKeys[`k${i}`] = i
    const res = await POST(postReq({ source: 'client', message: 'ok', context: manyKeys }))
    expect(res.status).toBe(413)
    expect(logAppError).not.toHaveBeenCalled()
  })

  it('rejects when the caller is rate-limited', async () => {
    vi.mocked(checkRateLimit).mockResolvedValue({ allowed: false, remaining: 0, reason: 'rate_limited' })
    const res = await POST(postReq({ source: 'client', message: 'ok' }))
    expect(res.status).toBe(429)
    expect(logAppError).not.toHaveBeenCalled()
  })

  it('stays safe for the crashing client when logging itself fails (never throws, never exposes internals)', async () => {
    vi.mocked(logAppError).mockRejectedValue(new Error('supabase insert failed: relation does not exist'))
    const res = await POST(postReq({ source: 'client', message: 'ok' }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(JSON.stringify(body)).not.toContain('relation does not exist')
  })
})
