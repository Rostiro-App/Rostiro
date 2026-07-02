import { getSleeperUser, getSleeperLeagues } from '@/lib/sleeper'
import { NextResponse, type NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  const username = request.nextUrl.searchParams.get('username')
  if (!username) {
    return NextResponse.json({ error: 'username is required' }, { status: 400 })
  }

  try {
    const user = await getSleeperUser(username)
    const leagues = await getSleeperLeagues(user.user_id)
    return NextResponse.json({ userId: user.user_id, displayName: user.display_name, leagues })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 404 })
  }
}
