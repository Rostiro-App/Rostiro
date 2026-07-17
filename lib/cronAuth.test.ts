import { describe, it, expect, afterEach } from 'vitest'
import { isAuthorizedCronRequest } from './cronAuth'

function req(authHeader?: string): Request {
  const headers = new Headers()
  if (authHeader !== undefined) headers.set('authorization', authHeader)
  return new Request('http://localhost/api/cron/x', { headers })
}

describe('isAuthorizedCronRequest', () => {
  const original = process.env.CRON_SECRET

  afterEach(() => {
    process.env.CRON_SECRET = original
  })

  it('rejects when CRON_SECRET is missing (fail closed, regression test for the "Bearer undefined" bug)', () => {
    delete process.env.CRON_SECRET
    expect(isAuthorizedCronRequest(req('Bearer undefined'))).toBe(false)
  })

  it('rejects when CRON_SECRET is an empty string', () => {
    process.env.CRON_SECRET = ''
    expect(isAuthorizedCronRequest(req('Bearer '))).toBe(false)
  })

  it('rejects when the authorization header is missing entirely', () => {
    process.env.CRON_SECRET = 'real-secret'
    expect(isAuthorizedCronRequest(req())).toBe(false)
  })

  it('rejects the literal string "Bearer undefined" even with a real secret configured', () => {
    process.env.CRON_SECRET = 'real-secret'
    expect(isAuthorizedCronRequest(req('Bearer undefined'))).toBe(false)
  })

  it('rejects a wrong secret', () => {
    process.env.CRON_SECRET = 'real-secret'
    expect(isAuthorizedCronRequest(req('Bearer wrong-secret'))).toBe(false)
  })

  it('accepts the correct secret', () => {
    process.env.CRON_SECRET = 'real-secret'
    expect(isAuthorizedCronRequest(req('Bearer real-secret'))).toBe(true)
  })
})
