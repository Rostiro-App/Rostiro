import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

describe('getYahooAuthUrl', () => {
  const originalClientId = process.env.YAHOO_CLIENT_ID
  const originalRedirectUri = process.env.YAHOO_REDIRECT_URI

  beforeEach(() => {
    process.env.YAHOO_CLIENT_ID = 'test-client-id'
    process.env.YAHOO_REDIRECT_URI = 'https://rostiro.com/api/auth/yahoo/callback'
  })

  afterEach(() => {
    process.env.YAHOO_CLIENT_ID = originalClientId
    process.env.YAHOO_REDIRECT_URI = originalRedirectUri
  })

  it('requests only the read-only fspt-r scope, never fspt-w (Yahoo has not approved write access)', async () => {
    const { getYahooAuthUrl } = await import('./yahoo')
    const url = getYahooAuthUrl('test-state')
    const scope = new URL(url).searchParams.get('scope')
    expect(scope).toBe('fspt-r')
    expect(url).not.toContain('fspt-w')
  })

  it('includes the provided state and configured client_id/redirect_uri', async () => {
    const { getYahooAuthUrl } = await import('./yahoo')
    const url = new URL(getYahooAuthUrl('abc123'))
    expect(url.searchParams.get('state')).toBe('abc123')
    expect(url.searchParams.get('client_id')).toBe('test-client-id')
    expect(url.searchParams.get('redirect_uri')).toBe('https://rostiro.com/api/auth/yahoo/callback')
    expect(url.searchParams.get('response_type')).toBe('code')
  })

  it('throws a config error instead of building an invalid URL when env vars are missing', async () => {
    delete process.env.YAHOO_CLIENT_ID
    const { getYahooAuthUrl } = await import('./yahoo')
    expect(() => getYahooAuthUrl('state')).toThrow('YAHOO_CLIENT_ID is not configured')
  })
})

describe('isReadCompatibleScope', () => {
  it('accepts fspt-r', async () => {
    const { isReadCompatibleScope } = await import('./yahoo')
    expect(isReadCompatibleScope('fspt-r')).toBe(true)
  })

  it('accepts fspt-w as a superset of read', async () => {
    const { isReadCompatibleScope } = await import('./yahoo')
    expect(isReadCompatibleScope('fspt-w')).toBe(true)
  })

  it('rejects an unrelated or empty scope', async () => {
    const { isReadCompatibleScope } = await import('./yahoo')
    expect(isReadCompatibleScope('openid profile')).toBe(false)
    expect(isReadCompatibleScope('')).toBe(false)
  })
})

describe('exchangeYahooCode', () => {
  beforeEach(() => {
    process.env.YAHOO_CLIENT_ID = 'test-client-id'
    process.env.YAHOO_CLIENT_SECRET = 'test-secret'
    process.env.YAHOO_REDIRECT_URI = 'https://rostiro.com/api/auth/yahoo/callback'
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('returns tokens when Yahoo grants a read-compatible scope', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        access_token: 'at', refresh_token: 'rt', expires_in: 3600, token_type: 'bearer', scope: 'fspt-r',
      }),
    } as Response)
    const { exchangeYahooCode } = await import('./yahoo')
    const tokens = await exchangeYahooCode('some-code')
    expect(tokens.accessToken).toBe('at')
    expect(tokens.refreshToken).toBe('rt')
    expect(tokens.scope).toBe('fspt-r')
  })

  it('rejects with a reconnect-required error if Yahoo grants a scope that cannot read (config drift)', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        access_token: 'at', refresh_token: 'rt', expires_in: 3600, token_type: 'bearer', scope: 'openid',
      }),
    } as Response)
    const { exchangeYahooCode } = await import('./yahoo')
    await expect(exchangeYahooCode('some-code')).rejects.toMatchObject({ code: 'YAHOO_RECONNECT_REQUIRED' })
  })

  it('never leaks the raw Yahoo error response body in the thrown error message', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      status: 400,
      text: () => Promise.resolve('{"error":"invalid_grant","secret_leak":"should never appear"}'),
    } as Response)
    const { exchangeYahooCode } = await import('./yahoo')
    await expect(exchangeYahooCode('bad-code')).rejects.toSatisfy((err: unknown) => {
      const message = err instanceof Error ? err.message : String(err)
      return !message.includes('secret_leak') && !message.includes('invalid_grant')
    })
  })
})

describe('refreshYahooTokens', () => {
  beforeEach(() => {
    process.env.YAHOO_CLIENT_ID = 'test-client-id'
    process.env.YAHOO_CLIENT_SECRET = 'test-secret'
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('preserves the existing refresh token when Yahoo legally omits a replacement', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ access_token: 'new-at', expires_in: 3600, scope: 'fspt-r' }), // no refresh_token field
    } as Response)
    const { refreshYahooTokens } = await import('./yahoo')
    const result = await refreshYahooTokens('original-refresh-token')
    expect(result.refreshToken).toBe('original-refresh-token')
    expect(result.accessToken).toBe('new-at')
  })

  it('uses the new refresh token when Yahoo does rotate it', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ access_token: 'new-at', refresh_token: 'rotated-rt', expires_in: 3600, scope: 'fspt-r' }),
    } as Response)
    const { refreshYahooTokens } = await import('./yahoo')
    const result = await refreshYahooTokens('original-refresh-token')
    expect(result.refreshToken).toBe('rotated-rt')
  })

  it('marks an unrecoverable refresh failure (dead refresh token) as reconnect-required', async () => {
    vi.mocked(fetch).mockResolvedValue({ ok: false, status: 400, text: () => Promise.resolve('invalid_grant') } as Response)
    const { refreshYahooTokens } = await import('./yahoo')
    await expect(refreshYahooTokens('dead-token')).rejects.toMatchObject({ code: 'YAHOO_RECONNECT_REQUIRED' })
  })

  it('treats a 5xx Yahoo failure as transient, not reconnect-required', async () => {
    vi.mocked(fetch).mockResolvedValue({ ok: false, status: 503, text: () => Promise.resolve('unavailable') } as Response)
    const { refreshYahooTokens } = await import('./yahoo')
    await expect(refreshYahooTokens('some-token')).rejects.toMatchObject({ code: 'YAHOO_TOKEN_REFRESH_ERROR' })
  })
})
