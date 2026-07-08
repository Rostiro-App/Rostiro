// Supabase Auth callback — handles magic link and OAuth redirects.
// Exchanges the code for a session and redirects to onboarding or dashboard.

import { createSSRClient } from '@/lib/supabase'
import { sendWelcomeEmail } from '@/lib/resend'
import { NextResponse, type NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/pulse'

  if (code) {
    const supabase = await createSSRClient()
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)
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
  }

  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`)
}
