// Login now goes through here instead of the client calling
// supabase.auth.signInWithPassword() directly — that path has no
// app-level throttle, so nothing stood between it and an unlimited
// password-guessing loop. Uses createSSRClient (not createAdminClient)
// so a successful sign-in sets the real session cookies on the response,
// same as app/api/auth/callback/route.ts's exchangeCodeForSession/verifyOtp.
//
// Rate-limited by IP (stop a scripted loop generally) and by email
// (stop distributed brute-forcing of one specific account from many IPs)
// — same dual-key reasoning as forgot-password/route.ts.

import { createAdminClient, createSSRClient } from '@/lib/supabase'
import { checkRateLimit, getClientIp } from '@/lib/rateLimit'
import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'

const Body = z.object({ email: z.string().email(), password: z.string().min(1) })

const RATE_LIMIT = 10
const RATE_WINDOW_SECONDS = 60 * 15

export async function POST(request: NextRequest) {
  const admin = createAdminClient()
  const ip = getClientIp(request)
  const ipCheck = await checkRateLimit(admin, `login:ip:${ip}`, RATE_LIMIT, RATE_WINDOW_SECONDS)
  if (!ipCheck.allowed) {
    return NextResponse.json({ error: 'Too many login attempts — try again later.' }, { status: 429 })
  }

  const parsed = Body.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: 'A valid email and password are required.' }, { status: 400 })
  }
  const { email, password } = parsed.data

  const emailCheck = await checkRateLimit(admin, `login:email:${email.toLowerCase()}`, RATE_LIMIT, RATE_WINDOW_SECONDS)
  if (!emailCheck.allowed) {
    return NextResponse.json({ error: 'Too many login attempts for this account — try again later.' }, { status: 429 })
  }

  const supabase = await createSSRClient()
  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ ok: true })
}
