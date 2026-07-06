import { createSSRClient } from '@/lib/supabase'
import { NextResponse } from 'next/server'

// T-128: was hardcoded to NEXT_PUBLIC_APP_URL, which .env.local (and
// .env.example) both set to the production URL — so signing out locally
// (or from any preview deploy) actually succeeded server-side, then
// redirected the browser away to the live production site instead of
// staying on the same origin. Looked exactly like "sign out does
// nothing," reproduced across multiple sessions, since it's not
// session-specific — it fires in every environment except real
// production. Deriving the redirect from the incoming request's own
// origin instead needs no env var and can't drift out of sync with
// wherever the app is actually running.
export async function POST(request: Request) {
  const supabase = await createSSRClient()
  await supabase.auth.signOut()
  return NextResponse.redirect(new URL('/login', request.url))
}
