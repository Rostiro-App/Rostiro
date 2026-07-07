// T-138: the one bridge between client-side errors and lib/errorLog.ts.
// app/global-error.tsx is a Client Component and can't import logAppError
// directly — that pulls in lib/supabase.ts's createAdminClient, which
// depends on next/headers and is server-only. Deliberately unauthenticated
// (an error boundary firing usually means something's already broken;
// requiring a valid session here would drop errors from exactly the users
// most likely to be logged out or mid-crash) and best-effort — this must
// never itself throw back at an already-crashing client.

import { logAppError } from '@/lib/errorLog'
import { NextResponse } from 'next/server'
import { z } from 'zod'

const Body = z.object({
  source: z.string().min(1).max(100),
  message: z.string().min(1).max(2000),
  stack: z.string().max(5000).nullable().optional(),
  context: z.record(z.string(), z.unknown()).optional(),
})

export async function POST(request: Request) {
  const parsed = Body.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ ok: false }, { status: 400 })

  await logAppError(parsed.data.source, new Error(parsed.data.message), parsed.data.context, parsed.data.stack)
  return NextResponse.json({ ok: true })
}
