import { exchangeYahooCode } from '@/lib/yahoo'
import { encrypt } from '@/lib/encrypt'
import { createSSRClient, createAdminClient } from '@/lib/supabase'
import { logAppError } from '@/lib/errorLog'
import { validateYahooReturnTo } from '@/lib/yahooReturnTo'
import { YahooAPIError } from '@/types'
import { NextResponse, type NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const storedState = request.cookies.get('yahoo_oauth_state')?.value

  // T-128: same bug as app/api/auth/signout/route.ts — was hardcoded to
  // NEXT_PUBLIC_APP_URL, which .env.local sets to the production URL, so
  // this would misredirect in any environment where that env var doesn't
  // exactly match the domain Yahoo actually redirected back to (local
  // dev, a preview deploy, etc.). Yahoo's own redirect already lands on
  // whatever domain is correct for this request, so deriving from that
  // request's own origin instead is strictly more correct, not just a
  // local-dev workaround.
  const appUrl = origin

  // Re-validated here, not just trusted from the cookie we set — defense
  // in depth against an open redirect even though this cookie is our own
  // (httpOnly, short-lived) rather than client-readable/writable.
  const returnTo = validateYahooReturnTo(request.cookies.get('yahoo_oauth_return_to')?.value)

  function redirectTo(path: string, clearCookies: boolean) {
    const response = NextResponse.redirect(`${appUrl}${path}`)
    if (clearCookies) {
      response.cookies.delete('yahoo_oauth_state')
      response.cookies.delete('yahoo_oauth_return_to')
    }
    return response
  }

  if (!code || !state || state !== storedState) {
    return redirectTo(`${returnTo}?error=yahoo_auth_failed`, true)
  }

  const supabase = await createSSRClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return redirectTo('/login', false)
  }

  try {
    const tokens = await exchangeYahooCode(code)
    const admin = createAdminClient()

    const { error: upsertError } = await admin.from('yahoo_tokens').upsert({
      user_id: user.id,
      access_token: encrypt(tokens.accessToken),
      refresh_token: encrypt(tokens.refreshToken),
      expires_at: tokens.expiresAt.toISOString(),
      scope: tokens.scope,
    }, { onConflict: 'user_id' })

    if (upsertError) {
      // The token exchange with Yahoo succeeded, but Rostiro couldn't
      // persist it — this must never be reported as connected. Never log
      // the actual tokens; upsertError.message is a Postgres/PostgREST
      // error string, not token material.
      await logAppError('auth/yahoo/callback', new Error(`yahoo_tokens upsert failed: ${upsertError.message}`), { userId: user.id })
      return redirectTo(`${returnTo}?error=yahoo_token_failed`, true)
    }

    // Deliberately NOT "?yahoo=connected" — a stored token isn't a
    // completed connection yet. The originating flow (onboarding/Add
    // League) is responsible for visibly entering an importing state,
    // calling POST /api/leagues/yahoo, and only then treating Yahoo as
    // connected once that call actually returns.
    return redirectTo(`${returnTo}?yahoo=importing`, true)
  } catch (err) {
    // err is always a YahooAPIError with an already-sanitized message (see
    // exchangeYahooCode) — never the raw code, tokens, client secret, or a
    // full Yahoo response body. Safe to log as-is.
    await logAppError('auth/yahoo/callback', err, { userId: user.id })
    const errorParam = err instanceof YahooAPIError && err.code === 'YAHOO_RECONNECT_REQUIRED'
      ? 'yahoo_reconnect_required'
      : 'yahoo_token_failed'
    return redirectTo(`${returnTo}?error=${errorParam}`, true)
  }
}
