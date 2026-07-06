// T-117: pure, client-safe league deep links for the Leagues page. Not
// re-exported from lib/espn.ts / lib/yahoo.ts on purpose — those modules
// read process.env secrets (OAuth client id/secret) at module scope, so a
// 'use client' page importing them would pull that whole module (and its
// server-only surface) into the client bundle. This file has zero
// dependencies and nothing sensitive in it.

export function sleeperLeagueUrl(leagueId: string): string {
  return `https://sleeper.com/leagues/${leagueId}`
}

export function espnLeagueUrl(leagueId: string): string {
  return `https://fantasy.espn.com/football/league?leagueId=${leagueId}`
}

export function yahooLeagueUrl(leagueKey: string): string {
  const leagueId = leagueKey.split('.l.')[1] ?? leagueKey
  return `https://football.fantasysports.yahoo.com/f1/${leagueId}`
}
