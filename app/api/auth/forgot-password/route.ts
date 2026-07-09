// T-135: password reset now goes through here instead of the client calling
// supabase.auth.resetPasswordForEmail() directly, same reasoning as
// app/api/auth/signup/route.ts — admin.generateLink generates the recovery
// link without sending anything, so Resend is the one actually emailing it.
// Also same token_hash reasoning as signup/route.ts: we email our own
// callback URL rather than Supabase's action_link, since generateLink can't
// produce a PKCE code and the implicit-flow fragment it redirects with
// can't be read server-side.

import { createAdminClient } from '@/lib/supabase'
import { sendPasswordResetEmail } from '@/lib/resend'
import { checkRateLimit, getClientIp } from '@/lib/rateLimit'
import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'

const Body = z.object({ email: z.string().email() })

// Two separate keys: IP-keyed stops a scripted loop hitting this route
// generally, email-keyed stops someone email-bombing one specific inbox
// with reset links from many different IPs — the two abuse shapes need
// different keys to actually be caught.
const RATE_LIMIT = 5
const RATE_WINDOW_SECONDS = 60 * 60

export async function POST(request: NextRequest) {
  const admin = createAdminClient()
  const ip = getClientIp(request)
  const ipCheck = await checkRateLimit(admin, `forgot-password:ip:${ip}`, RATE_LIMIT, RATE_WINDOW_SECONDS)
  if (!ipCheck.allowed) {
    return NextResponse.json({ error: 'Too many requests — try again later.' }, { status: 429 })
  }

  const parsed = Body.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: 'A valid email is required.' }, { status: 400 })
  }
  const { email } = parsed.data

  const emailCheck = await checkRateLimit(admin, `forgot-password:email:${email.toLowerCase()}`, RATE_LIMIT, RATE_WINDOW_SECONDS)
  if (!emailCheck.allowed) {
    // Same generic response as "account doesn't exist" below — a distinct
    // message here would leak that this address is being rate-limited,
    // which is itself a signal an attacker could use.
    return NextResponse.json({
      ok: true,
      message: "If an account exists for that email, we've sent a link to reset your password.",
    })
  }
  const redirectTo = `${new URL(request.url).origin}/api/auth/callback?next=/reset-password`

  const { data, error } = await admin.auth.admin.generateLink({
    type: 'recovery',
    email,
    options: { redirectTo },
  })

  // Same response whether the account exists, sending failed, or
  // generateLink itself errored — this form must never be usable to check
  // which emails have a Rostiro account.
  if (!error && data.properties?.hashed_token) {
    const resetUrl = `${new URL(request.url).origin}/api/auth/callback?token_hash=${encodeURIComponent(data.properties.hashed_token)}&type=recovery&next=/reset-password`
    try {
      await sendPasswordResetEmail(email, resetUrl)
    } catch {
      // Best-effort — a Resend outage shouldn't leak "this account exists"
      // via a different response shape than the generic one below.
    }
  }

  return NextResponse.json({
    ok: true,
    message: "If an account exists for that email, we've sent a link to reset your password.",
  })
}
