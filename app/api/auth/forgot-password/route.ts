// T-135: password reset now goes through here instead of the client calling
// supabase.auth.resetPasswordForEmail() directly, same reasoning as
// app/api/auth/signup/route.ts — admin.generateLink generates the recovery
// link without sending anything, so Resend is the one actually emailing it.

import { createAdminClient } from '@/lib/supabase'
import { sendPasswordResetEmail } from '@/lib/resend'
import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'

const Body = z.object({ email: z.string().email() })

export async function POST(request: NextRequest) {
  const parsed = Body.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: 'A valid email is required.' }, { status: 400 })
  }
  const { email } = parsed.data

  const admin = createAdminClient()
  const redirectTo = `${new URL(request.url).origin}/api/auth/callback?next=/reset-password`

  const { data, error } = await admin.auth.admin.generateLink({
    type: 'recovery',
    email,
    options: { redirectTo },
  })

  // Same response whether the account exists, sending failed, or
  // generateLink itself errored — this form must never be usable to check
  // which emails have a Rostiro account.
  if (!error && data.properties?.action_link) {
    try {
      await sendPasswordResetEmail(email, data.properties.action_link)
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
