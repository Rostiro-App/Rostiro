// T-141: Notes — one shared table/route for both note types (see
// migration_notes.sql). This pass only ships 'general' from the UI;
// 'ask_copilot' (T-142) reuses this same schema/route additively later.
//
// league_name/player_name are resolved here via join queries rather than
// stored on the note row — a league gets renamed or a player's cached name
// changes, and a stored copy would silently go stale. RLS (auth.uid() =
// user_id) is what actually scopes every query below to the caller; the
// explicit .eq('user_id', user.id) filters are redundant with it but kept
// so intent is obvious from reading the route, not just the policy.

import { createSSRClient } from '@/lib/supabase'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import type { Note, NoteType } from '@/types'

const MAX_BODY_LENGTH: Record<NoteType, number> = {
  general: 500,
  ask_copilot: 280,
}

const Body = z
  .object({
    type: z.enum(['general', 'ask_copilot']).default('general'),
    body: z.string().min(1),
    leagueId: z.string().uuid().nullable().optional(),
    playerId: z.string().nullable().optional(),
  })
  .refine((d) => d.body.length <= MAX_BODY_LENGTH[d.type], {
    message: 'Note is too long for this note type.',
  })

interface NoteRow {
  id: string
  user_id: string
  league_id: string | null
  player_id: string | null
  type: NoteType
  body: string
  response: string | null
  created_at: string
  updated_at: string
}

export async function GET() {
  const supabase = await createSSRClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: notes, error } = await supabase
    .from('notes')
    .select('id, user_id, league_id, player_id, type, body, response, created_at, updated_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (error) {
    // 42P01 / PGRST205 — migration_notes.sql not run yet.
    if (error.code === '42P01' || error.code === 'PGRST205') return NextResponse.json({ notes: [] })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const rows = (notes ?? []) as NoteRow[]
  const leagueIds = [...new Set(rows.map((n) => n.league_id).filter((id): id is string => id !== null))]
  const playerIds = [...new Set(rows.map((n) => n.player_id).filter((id): id is string => id !== null))]

  const [leaguesRes, playersRes] = await Promise.all([
    leagueIds.length
      ? supabase.from('connected_leagues').select('id, league_name').in('id', leagueIds)
      : Promise.resolve({ data: [] as { id: string; league_name: string }[] }),
    playerIds.length
      ? supabase.from('players_cache').select('player_id, name').eq('platform', 'sleeper').in('player_id', playerIds)
      : Promise.resolve({ data: [] as { player_id: string; name: string }[] }),
  ])

  const leagueNameById = new Map((leaguesRes.data ?? []).map((l) => [l.id, l.league_name]))
  const playerNameById = new Map((playersRes.data ?? []).map((p) => [p.player_id, p.name]))

  const result: Note[] = rows.map((n) => ({
    id: n.id,
    userId: n.user_id,
    leagueId: n.league_id,
    leagueName: n.league_id ? leagueNameById.get(n.league_id) ?? null : null,
    playerId: n.player_id,
    playerName: n.player_id ? playerNameById.get(n.player_id) ?? null : null,
    type: n.type,
    body: n.body,
    response: n.response,
    createdAt: n.created_at,
    updatedAt: n.updated_at,
  }))

  return NextResponse.json({ notes: result })
}

export async function POST(request: Request) {
  const supabase = await createSSRClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const parsed = Body.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid note' }, { status: 400 })
  }
  const { type, body, leagueId, playerId } = parsed.data

  const { data, error } = await supabase
    .from('notes')
    .insert({ user_id: user.id, type, body, league_id: leagueId ?? null, player_id: playerId ?? null })
    .select('id')
    .single()

  if (error) {
    if (error.code === '42P01' || error.code === 'PGRST205') {
      return NextResponse.json({ error: 'Notes are not enabled yet — run migration_notes.sql' }, { status: 503 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, id: data.id })
}
