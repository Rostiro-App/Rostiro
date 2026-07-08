// Supabase Auth callback — handles magic link and OAuth redirects.
// Exchanges the code (PKCE) or token_hash (admin.generateLink links — see
// app/api/auth/signup/route.ts and forgot-password/route.ts, which cannot
// produce a PKCE code since generateLink is a server-to-server admin call
// with no client code_verifier) for a session, then redirects to onboarding
// or dashboard.

import { createSSRClient } from '@/lib/supabase'
import { sendWelcomeEmail } from '@/lib/resend'
import { NextResponse, type NextRequest } from 'next/server'
import type { EmailOtpType } from '@supabase/supabase-js'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const tokenHash = searchParams.get('token_hash')
  const type = searchParams.get('type') as EmailOtpType | null
  const next = searchParams.get('next') ?? '/pulse'

  const supabase = await createSSRClient()
  const { data, error } = code
    ? await supabase.auth.exchangeCodeForSession(code)
    : tokenHash && type
      ? await supabase.auth.verifyOtp({ token_hash: tokenHash, type })
      : { data: { user: null }, error: new Error('No code or token_hash provided') }

  if (!error) {
    // next=/onboarding only ever comes from app/api/auth/signup/route.ts's
    // redirectTo — every other caller of this shared callback (password
    // reset, any future OAuth flow) uses a different `next`, so this is
    // the one reliable signal that this is a fresh signup confirmation,
    // not just "a session now exists."
    if (next === '/onboarding' && data.user?.email) {
      try {
        await sendWelcomeEmail(data.user.email)
      } catch {
        // A welcome email failing to send must never block onboarding.
      }
    }
    return NextResponse.redirect(`${origin}${next}`)
  }

  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`)
}
