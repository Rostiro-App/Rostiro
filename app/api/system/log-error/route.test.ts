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

  it('rejects a body that is under MAX_BODY_BYTES by .length but over it in real UTF-8 bytes (regression: multibyte undercounting)', async () => {
    // Each '中' is 1 UTF-16 code unit (counted by .length) but 3 UTF-8
    // bytes. message (2000 chars, zod max) + stack (5000 chars, zod max)
    // individually satisfy every per-field cap, and no content-length
    // header is sent, but their combined UTF-8 byte size (~21KB) exceeds
    // MAX_BODY_BYTES (16KB) while the raw JSON string's .length (~7KB)
    // does not — a body that would have silently sailed through and hit
    // logAppError under the old `raw.length` check.
    const message = '中'.repeat(2000)
    const stack = '中'.repeat(5000)
    const res = await POST(postReq({ source: 'client', message, stack }))
    expect(res.status).toBe(413)
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

  it('returns 503, not 429, when the limiter itself is unavailable (fail-closed, not "you did something wrong")', async () => {
    vi.mocked(checkRateLimit).mockResolvedValue({ allowed: false, remaining: 0, reason: 'service_unavailable' })
    const res = await POST(postReq({ source: 'client', message: 'ok' }))
    expect(res.status).toBe(503)
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
