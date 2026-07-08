// T-111: priority feedback access — a real, separate channel from generic
// support, gated server-side on plan='commissioner' (not just hidden in the
// UI), so it's an actual Founding 500 benefit rather than a client-side
// courtesy anyone could bypass.

import { createSSRClient } from '@/lib/supabase'
import { sendFeedbackReceivedEmail, sendFeedbackNotificationEmail } from '@/lib/resend'
import { NextResponse } from 'next/server'
import { z } from 'zod'

const Body = z.object({ message: z.string().min(1).max(2000) })

export async function POST(request: Request) {
  const supabase = await createSSRClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('users').select('plan').eq('id', user.id).maybeSingle()
  if (profile?.plan !== 'commissioner') {
    return NextResponse.json({ error: 'Founder feedback is a Founding 500 benefit' }, { status: 403 })
  }

  const parsed = Body.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: 'message required' }, { status: 400 })
  }

  const { error } = await supabase
    .from('founder_feedback')
    .insert({ user_id: user.id, message: parsed.data.message })

  if (error) {
    // 42P01 (Postgres "undefined_table") / PGRST205 (PostgREST's schema-cache
    // equivalent) both mean migration_founder_recognition.sql hasn't run yet.
    if (error.code === '42P01' || error.code === 'PGRST205') {
      return NextResponse.json(
        { error: 'Founder feedback not enabled yet — run migration_founder_recognition.sql' },
        { status: 503 }
      )
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (user.email) {
    try {
      await sendFeedbackReceivedEmail(user.email)
    } catch {
      // Feedback is already saved — a failed confirmation email is not an error.
    }
    const adminEmail = process.env.ADMIN_EMAIL
    if (adminEmail) {
      try {
        await sendFeedbackNotificationEmail(adminEmail, user.email, parsed.data.message)
      } catch {
        // Same posture — the founder notification is a courtesy, not a
        // requirement for the feedback submission itself to succeed.
      }
    }
  }

  return NextResponse.json({ ok: true })
}
