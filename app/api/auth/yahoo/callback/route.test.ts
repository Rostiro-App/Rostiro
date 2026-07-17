import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const mockUser = { id: 'user-1' }

function req(opts: {
  code?: string
  state?: string
  cookieState?: string
  cookieReturnTo?: string
} = {}) {
  const { code = 'auth-code', state = 'state-abc', cookieState = 'state-abc', cookieReturnTo = '/leagues/add' } = opts
  const params = new URLSearchParams()
  if (code) params.set('code', code)
  if (state) params.set('state', state)
  const cookieParts: string[] = []
  if (cookieState) cookieParts.push(`yahoo_oauth_state=${cookieState}`)
  if (cookieReturnTo) cookieParts.push(`yahoo_oauth_return_to=${encodeURIComponent(cookieReturnTo)}`)
  return new NextRequest(`http://localhost/api/auth/yahoo/callback?${params.toString()}`, {
    headers: cookieParts.length ? { cookie: cookieParts.join('; ') } : {},
  })
}

describe('GET /api/auth/yahoo/callback', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.doUnmock('@/lib/yahoo')
    vi.doUnmock('@/lib/supabase')
    vi.doUnmock('@/lib/errorLog')
    vi.doUnmock('@/lib/encrypt')
  })

  it('redirects to the validated returnTo path with ?yahoo=importing on success, never ?yahoo=connected', async () => {
    vi.doMock('@/lib/yahoo', () => ({
      exchangeYahooCode: vi.fn(() => Promise.resolve({ accessToken: 'at', refreshToken: 'rt', expiresAt: new Date(), scope: 'fspt-r' })),
    }))
    vi.doMock('@/lib/supabase', () => ({
      createSSRClient: vi.fn(() => Promise.resolve({ auth: { getUser: () => Promise.resolve({ data: { user: mockUser } }) } })),
      createAdminClient: vi.fn(() => ({
        from: vi.fn(() => ({ upsert: vi.fn(() => Promise.resolve({ error: null })) })),
      })),
    }))
    vi.doMock('@/lib/errorLog', () => ({ logAppError: vi.fn(() => Promise.resolve()) }))
    vi.doMock('@/lib/encrypt', () => ({ encrypt: (v: string) => `enc(${v})` }))

    const { GET } = await import('./route')
    const res = await GET(req({ cookieReturnTo: '/leagues/add' }))
    const location = res.headers.get('location')
    expect(location).toContain('/leagues/add?yahoo=importing')
    expect(location).not.toContain('yahoo=connected')
  })

  it('falls back to /onboarding if the stored returnTo cookie is not allowlisted', async () => {
    vi.doMock('@/lib/yahoo', () => ({
      exchangeYahooCode: vi.fn(() => Promise.resolve({ accessToken: 'at', refreshToken: 'rt', expiresAt: new Date(), scope: 'fspt-r' })),
    }))
    vi.doMock('@/lib/supabase', () => ({
      createSSRClient: vi.fn(() => Promise.resolve({ auth: { getUser: () => Promise.resolve({ data: { user: mockUser } }) } })),
      createAdminClient: vi.fn(() => ({ from: vi.fn(() => ({ upsert: vi.fn(() => Promise.resolve({ error: null })) })) })),
    }))
    vi.doMock('@/lib/errorLog', () => ({ logAppError: vi.fn(() => Promise.resolve()) }))
    vi.doMock('@/lib/encrypt', () => ({ encrypt: (v: string) => `enc(${v})` }))

    const { GET } = await import('./route')
    const res = await GET(req({ cookieReturnTo: 'https://evil.example.com' }))
    expect(res.headers.get('location')).toContain('/onboarding?yahoo=importing')
  })

  it('never redirects with ?yahoo=importing when the token upsert fails to persist', async () => {
    vi.doMock('@/lib/yahoo', () => ({
      exchangeYahooCode: vi.fn(() => Promise.resolve({ accessToken: 'at', refreshToken: 'rt', expiresAt: new Date(), scope: 'fspt-r' })),
    }))
    vi.doMock('@/lib/supabase', () => ({
      createSSRClient: vi.fn(() => Promise.resolve({ auth: { getUser: () => Promise.resolve({ data: { user: mockUser } }) } })),
      createAdminClient: vi.fn(() => ({
        from: vi.fn(() => ({ upsert: vi.fn(() => Promise.resolve({ error: { message: 'db down' } })) })),
      })),
    }))
    vi.doMock('@/lib/errorLog', () => ({ logAppError: vi.fn(() => Promise.resolve()) }))
    vi.doMock('@/lib/encrypt', () => ({ encrypt: (v: string) => `enc(${v})` }))

    const { GET } = await import('./route')
    const res = await GET(req({ cookieReturnTo: '/onboarding' }))
    const location = res.headers.get('location')
    expect(location).toContain('error=yahoo_token_failed')
    expect(location).not.toContain('yahoo=importing')
  })

  it('rejects a mismatched state without ever calling exchangeYahooCode', async () => {
    const exchangeYahooCode = vi.fn()
    vi.doMock('@/lib/yahoo', () => ({ exchangeYahooCode }))
    vi.doMock('@/lib/supabase', () => ({
      createSSRClient: vi.fn(() => Promise.resolve({ auth: { getUser: () => Promise.resolve({ data: { user: mockUser } }) } })),
      createAdminClient: vi.fn(() => ({})),
    }))
    vi.doMock('@/lib/errorLog', () => ({ logAppError: vi.fn(() => Promise.resolve()) }))

    const { GET } = await import('./route')
    const res = await GET(req({ state: 'wrong', cookieState: 'state-abc' }))
    expect(res.headers.get('location')).toContain('error=yahoo_auth_failed')
    expect(exchangeYahooCode).not.toHaveBeenCalled()
  })

  it('requires an authenticated session before exchanging the code', async () => {
    const exchangeYahooCode = vi.fn()
    vi.doMock('@/lib/yahoo', () => ({ exchangeYahooCode }))
    vi.doMock('@/lib/supabase', () => ({
      createSSRClient: vi.fn(() => Promise.resolve({ auth: { getUser: () => Promise.resolve({ data: { user: null } }) } })),
      createAdminClient: vi.fn(() => ({})),
    }))
    vi.doMock('@/lib/errorLog', () => ({ logAppError: vi.fn(() => Promise.resolve()) }))

    const { GET } = await import('./route')
    const res = await GET(req())
    expect(res.headers.get('location')).toContain('/login')
    expect(exchangeYahooCode).not.toHaveBeenCalled()
  })
})
