// Sleeper's own CDN, keyed directly by the player_id/team abbreviation
// Rostiro already caches — zero new API calls, no ID mapping needed.
// Verified live (July 5, 2026): resolves for ranked starters and deep
// bench/rookie players alike. Same public-CDN pattern already relied on
// for lib/sleeper.ts's REST calls (no auth, meant for external use).

export function playerPhotoUrl(playerId: string): string {
  return `https://sleepercdn.com/content/nfl/players/${playerId}.jpg`
}

export function teamLogoUrl(teamAbbr: string): string {
  return `https://sleepercdn.com/images/team_logos/nfl/${teamAbbr.toLowerCase()}.png`
}
