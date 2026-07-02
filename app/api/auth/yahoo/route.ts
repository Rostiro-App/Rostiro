import { getYahooAuthUrl } from '@/lib/yahoo'
import { NextResponse } from 'next/server'
import crypto from 'crypto'

export async function GET() {
  const state = crypto.randomBytes(16).toString('hex')
  const authUrl = getYahooAuthUrl(state)

  const response = NextResponse.redirect(authUrl)
  // Store state in a short-lived cookie to verify on callback
  response.cookies.set('yahoo_oauth_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    maxAge: 600, // 10 minutes
    path: '/',
  })

  return response
}
