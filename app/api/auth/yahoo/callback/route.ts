import { exchangeYahooCode } from '@/lib/yahoo'
import { encrypt } from '@/lib/encrypt'
import { createSSRClient, createAdminClient } from '@/lib/supabase'
import { NextResponse, type NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const storedState = request.cookies.get('yahoo_oauth_state')?.value

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://rostiro.vercel.app'

  if (!code || !state || state !== storedState) {
    return NextResponse.redirect(`${appUrl}/onboarding?error=yahoo_auth_failed`)
  }

  const supabase = await createSSRClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.redirect(`${appUrl}/login`)
  }

  try {
    const tokens = await exchangeYahooCode(code)
    const admin = createAdminClient()

    await admin.from('yahoo_tokens').upsert({
      user_id: user.id,
      access_token: encrypt(tokens.accessToken),
      refresh_token: encrypt(tokens.refreshToken),
      expires_at: tokens.expiresAt.toISOString(),
      scope: tokens.scope,
    }, { onConflict: 'user_id' })

    const response = NextResponse.redirect(`${appUrl}/onboarding?yahoo=connected`)
    response.cookies.delete('yahoo_oauth_state')
    return response
  } catch (err) {
    console.error('[Yahoo callback]', err)
    return NextResponse.redirect(`${appUrl}/onboarding?error=yahoo_token_failed`)
  }
}
