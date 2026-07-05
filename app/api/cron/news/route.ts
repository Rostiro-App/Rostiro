// T-95 follow-up: ESPN NFL RSS ingestion cron. Deterministic layer only —
// no Claude call here. Tags each item with the players_cache rows its
// headline+summary actually mentions (lib/newsRelevance.ts); Pulse/the
// Player Intelligence Card filter this down to *rostered* players per-user
// at read time (PRD anti-pattern: "no generic NFL news blasts unfiltered by
// roster relevance").

import { createAdminClient } from '@/lib/supabase'
import { fetchEspnNflNews } from '@/lib/espnNews'
import { matchPlayerIds } from '@/lib/newsRelevance'
import { NextResponse, type NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const admin = createAdminClient()
    const [newsItems, { data: players, error: playersError }] = await Promise.all([
      fetchEspnNflNews(),
      // DEF rows are named after their team ("Kansas City Chiefs"), which
      // shows up constantly in unrelated stories (divisional roundtables, a
      // player's team mentioned in passing) — found live, July 5, 2026: a
      // Travis Kelce wedding story matched the Chiefs DEF purely because
      // the description said "Kansas City Chiefs tight end." Individual
      // players only.
      admin.from('players_cache').select('player_id, name').eq('platform', 'sleeper').neq('position', 'DEF'),
    ])
    if (playersError) throw new Error(playersError.message)

    const rows = newsItems.map((item) => {
      const text = `${item.headline} ${item.summary ?? ''}`
      const playerIds = matchPlayerIds(text, players ?? [])
      return {
        id: item.id,
        source: 'espn' as const,
        headline: item.headline,
        summary: item.summary,
        author: item.author,
        link: item.link,
        published_at: item.publishedAt,
        player_ids: playerIds,
      }
    })

    // Only items that actually mention a cached player are worth storing —
    // the rest (wedding announcements, court cases) never match anyone and
    // would just be dead rows.
    const relevantRows = rows.filter((r) => r.player_ids.length > 0)

    let synced = 0
    if (relevantRows.length > 0) {
      const { error } = await admin.from('news_items').upsert(relevantRows, { onConflict: 'id' })
      if (error) throw new Error(error.message)
      synced = relevantRows.length
    }

    return NextResponse.json({ fetched: newsItems.length, synced })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
