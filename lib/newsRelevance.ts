// Matches ingested news text to players_cache rows by full name — never by
// last name alone. A real ESPN item in production carried two different
// people surnamed "Taylor" in one day (a Ravens beat story, an unrelated
// court-case story) — last-name-only matching would have mistagged a real
// NFL player against a story about neither. Whole-word full-name matching
// against the combined headline+summary avoids that at the cost of missing
// second-reference-by-last-name-only mentions, an acceptable trade for
// correctness over recall.

export interface MatchablePlayer {
  player_id: string
  name: string
}

function normalize(s: string): string {
  return s.toLowerCase().replace(/[.'']/g, '').trim()
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function matchPlayerIds(text: string, players: MatchablePlayer[]): string[] {
  const haystack = normalize(text)
  const matched: string[] = []

  for (const p of players) {
    const name = normalize(p.name)
    // Skip single-word "names" (team/DEF entries, malformed rows) — no safe
    // way to whole-name match those without falling back to substring noise.
    if (!name.includes(' ')) continue

    const pattern = new RegExp(`\\b${escapeRegExp(name)}\\b`)
    if (pattern.test(haystack)) matched.push(p.player_id)
  }

  return matched
}
