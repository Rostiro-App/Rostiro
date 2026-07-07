// T-135: signup now goes through here instead of the client calling
// supabase.auth.signUp() directly — that path always fires Supabase's own
// built-in confirmation email (unbranded, not from rostiro.com), with no
// per-call way to swap in a different template short of Custom SMTP +
// dashboard-edited templates. admin.generateLink only *generates* the
// confirmation link; it creates the user but sends nothing, which is what
// lets Resend (lib/resend.ts) be the only thing that actually emails
// anyone here.

import { createAdminClient } from '@/lib/supabase'
import { sendSignupConfirmationEmail } from '@/lib/resend'
import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'

const Body = z.object({
  email: z.string().email(),
  password: z.string().min(8),
})

export async function POST(request: NextRequest) {
  const parsed = Body.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: 'A valid email and a password of at least 6 characters are required.' }, { status: 400 })
  }
  const { email, password } = parsed.data

  const admin = createAdminClient()
  const redirectTo = `${new URL(request.url).origin}/api/auth/callback?next=/onboarding`

  const { data, error } = await admin.auth.admin.generateLink({
    type: 'signup',
    email,
    password,
    options: { redirectTo },
  })

  if (error) {
    // "already registered" is the one case worth a distinct message —
    // everything else collapses to Supabase's own error text.
    const message = /already registered|already exists/i.test(error.message)
      ? 'An account with that email already exists. Try signing in instead.'
      : error.message
    return NextResponse.json({ error: message }, { status: 400 })
  }

  try {
    await sendSignupConfirmationEmail(email, data.properties.action_link)
  } catch {
    // The account exists either way — a delivery failure here shouldn't
    // read as signup itself having failed. Founder can resend via a
    // support path later if Resend genuinely didn't deliver.
    return NextResponse.json({
      ok: true,
      warning: 'Account created, but the confirmation email could not be sent. Contact support.',
    })
  }

  return NextResponse.json({ ok: true })
}
