// T-163: pure helpers shared by the push detector (detectStarterScratches) and
// the Pulse card builder. Kept side-effect-free so the grouping, dedup, merge,
// and message logic are unit-testable without DB/OneSignal.

import type { ScratchStatus } from './scratchClassifier'

export interface UserLeagueRoster { userId: string; leagueId: string; leagueName: string; starterIds: string[] }
export interface ScratchedPlayer { playerId: string; playerName: string; status: ScratchStatus }
export interface UserScratchGroup { playerNames: string[]; leagueNames: string[]; scratched: ScratchedPlayer[] }

// #1 + #2: one group per user, naming every affected league, starters only.
export function groupScratchedStartersByUser(
  rosters: UserLeagueRoster[],
  scratched: Map<string, ScratchedPlayer>,
): Map<string, UserScratchGroup> {
  const byUser = new Map<string, { players: Map<string, ScratchedPlayer>; leagues: Set<string> }>()
  for (const roster of rosters) {
    const hits = roster.starterIds.filter((id) => scratched.has(id))
    if (hits.length === 0) continue
    const entry = byUser.get(roster.userId) ?? { players: new Map(), leagues: new Set() }
    for (const id of hits) {
      const s = scratched.get(id)!
      entry.players.set(id, s)
      entry.leagues.add(roster.leagueName)
    }
    byUser.set(roster.userId, entry)
  }
  const out = new Map<string, UserScratchGroup>()
  for (const [userId, e] of byUser) {
    const scratchedList = [...e.players.values()]
    out.set(userId, {
      scratched: scratchedList,
      playerNames: scratchedList.map((s) => s.playerName),
      leagueNames: [...e.leagues],
    })
  }
  return out
}

// #6-push: status in the key so questionable->out escalates (new key -> fires),
// but a flip-flop back to a prior status re-uses a claimed key (no re-push).
export function scratchDedupeKey(playerId: string, status: ScratchStatus): string {
  return `scratch:${playerId}:${status}`
}

const SEVERITY: Record<string, number> = { out: 3, doubtful: 2, questionable: 1 }
const CANON: Record<string, string> = { out: 'Out', doubtful: 'Doubtful', questionable: 'Questionable' }

// Most-severe of the two valid signals wins; used by the card builder so a
// news scratch upgrades a stale Sleeper status but never masks a worse one.
export function resolveEffectiveInjury(sleeperStatus: string | null, scratchStatus: ScratchStatus | null): string | null {
  const candidates: string[] = []
  if (sleeperStatus) candidates.push(sleeperStatus.toLowerCase())
  if (scratchStatus) candidates.push(scratchStatus)
  const ranked = candidates.filter((c) => SEVERITY[c] !== undefined).sort((a, b) => SEVERITY[b] - SEVERITY[a])
  if (ranked.length === 0) return sleeperStatus // preserve non-scratch statuses (e.g. IR) untouched
  return CANON[ranked[0]]
}

// #5: "why you got this" league line.
export function formatScratchPush(playerNames: string[], leagueNames: string[]): { title: string; message: string } {
  const names = playerNames.join(', ')
  const first = leagueNames[0] ?? ''
  const extra = leagueNames.length - 1
  const leaguePart = extra > 0 ? `${first} +${extra} ${extra === 1 ? 'other' : 'others'}` : first
  const title = playerNames.length === 1 ? `${playerNames[0]} — ruled OUT` : `${playerNames.length} starters ruled OUT`
  return { title, message: `${names} ruled out. Starting in ${leaguePart}.` }
}
