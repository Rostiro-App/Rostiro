import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/yahoo', () => ({ getYahooAuthUrl: vi.fn(() => 'https://api.login.yahoo.com/oauth2/request_auth?mock=1') }))

import { GET } from './route'

describe('GET /api/auth/yahoo', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  function req(returnTo?: string) {
    const url = returnTo
      ? `http://localhost/api/auth/yahoo?returnTo=${encodeURIComponent(returnTo)}`
      : 'http://localhost/api/auth/yahoo'
    return new NextRequest(url)
  }

  it('stores an allowlisted returnTo value in a cookie', async () => {
    const res = await GET(req('/leagues/add'))
    expect(res.cookies.get('yahoo_oauth_return_to')?.value).toBe('/leagues/add')
  })

  it('falls back to /onboarding for a non-allowlisted returnTo value (open-redirect guard)', async () => {
    const res = await GET(req('https://evil.example.com'))
    expect(res.cookies.get('yahoo_oauth_return_to')?.value).toBe('/onboarding')
  })

  it('falls back to /onboarding when no returnTo is given', async () => {
    const res = await GET(req())
    expect(res.cookies.get('yahoo_oauth_return_to')?.value).toBe('/onboarding')
  })

  it('sets the state cookie httpOnly with sameSite lax', async () => {
    const res = await GET(req('/onboarding'))
    const stateCookie = res.cookies.get('yahoo_oauth_state')
    expect(stateCookie?.value).toBeTruthy()
  })
})
