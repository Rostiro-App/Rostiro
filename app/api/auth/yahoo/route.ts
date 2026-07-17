import { getYahooAuthUrl } from '@/lib/yahoo'
import { validateYahooReturnTo } from '@/lib/yahooReturnTo'
import { NextResponse, type NextRequest } from 'next/server'
import crypto from 'crypto'

export async function GET(request: NextRequest) {
  const state = crypto.randomBytes(16).toString('hex')
  const authUrl = getYahooAuthUrl(state)

  // Validated against an explicit allowlist (lib/yahooReturnTo.ts) before
  // ever being stored — this is client-controlled input, and blindly
  // trusting it as a redirect target later would be an open redirect.
  const returnTo = validateYahooReturnTo(request.nextUrl.searchParams.get('returnTo'))

  const response = NextResponse.redirect(authUrl)
  const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    maxAge: 600, // 10 minutes
    path: '/',
  }
  // Store state in a short-lived cookie to verify on callback
  response.cookies.set('yahoo_oauth_state', state, cookieOptions)
  response.cookies.set('yahoo_oauth_return_to', returnTo, cookieOptions)

  return response
}
