// Packet 02: Yahoo's capability declaration for the canonical platform
// contract. Yahoo has approved Rostiro for read access only — all three
// write capabilities are false until (if ever) a separate write-access
// grant exists. This is a static, honest declaration checked into code,
// never inferred from a token's scope string at runtime (a scope string
// says what a specific token can do; this says what Rostiro's Yahoo
// integration is built to do today — the two must never be conflated).
//
// The full normalizeYahooLeague -> NormalizedLeague conversion is Packet
// 02's Workstream C/E (the Yahoo import route) and depends on real
// sanitized Yahoo fixtures that don't exist yet — see lib/normalize.ts's
// existing normalizeYahooLeague() for the current (League-only, not yet
// NormalizedLeague) Yahoo normalizer, and the Packet 02 completion report
// for exactly what's blocked and why.

import type { PlatformCapabilities } from './types'

export const YAHOO_CAPABILITIES: PlatformCapabilities = {
  leagueRead: true,
  rosterRead: true,
  matchupRead: true,
  draftRead: true,
  freeAgentRead: true,
  lineupWrite: false,
  waiverWrite: false,
  tradeWrite: false,
}
