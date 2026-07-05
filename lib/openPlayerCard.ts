// Shared trigger for the Player Intelligence Card (T-89) — every clickable
// player row across the app (⌘K, Draft Kit, Lineups) dispatches the same
// event PlayerIntelligenceCard listens for, mounted once in AppShell.
export function openPlayerCard(playerId: string) {
  window.dispatchEvent(new CustomEvent('rostiro:open-player-card', { detail: { playerId } }))
}
