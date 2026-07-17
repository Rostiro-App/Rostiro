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

import type { League } from '@/types'
import { parseYahooDraftInfo, parseYahooWaiverSettings } from '@/lib/normalize'
import type { NormalizedLeague, PlatformCapabilities, DataQualityWarning } from './types'

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

// Composes an already-normalized League (lib/normalize.ts's
// normalizeYahooLeague) with the additional canonical-contract fields —
// draft/waiver info parsed from the same raw settings object, capabilities,
// and data-quality warnings for anything that couldn't be confidently
// parsed. The draft/waiver parsing is UNVERIFIED against a live Yahoo
// response (see lib/normalize.ts's parseYahooDraftInfo/
// parseYahooWaiverSettings) — this function surfaces that honestly via
// warnings rather than silently reporting 'unknown' with no explanation.
export function toNormalizedYahooLeague(
  league: League,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  rawSettings: any
): NormalizedLeague {
  const draftInfo = parseYahooDraftInfo(rawSettings)
  const waiverInfo = parseYahooWaiverSettings(rawSettings)

  const warnings: DataQualityWarning[] = [
    // Packet 02 correction pass: leagueStatus used to be DERIVED from
    // draft.status ('complete' draft -> 'complete' league) — wrong. A
    // league whose draft finished stays active for the entire regular
    // season and playoffs; conflating "draft done" with "season over"
    // would have misreported every in-season league as complete the
    // moment its draft wrapped. No Yahoo field for genuine league-season
    // status (as opposed to draft status) has been identified and
    // verified yet, so this reports 'unknown' honestly instead of
    // guessing from an unrelated field.
    { field: 'leagueStatus', message: 'Real Yahoo league-season status is not yet verified — reporting unknown rather than deriving it from draft status' },
  ]
  if (draftInfo.status === 'unknown') {
    warnings.push({ field: 'draft.status', message: 'Could not determine draft status from Yahoo response' })
  }
  if (waiverInfo.type === 'unknown') {
    warnings.push({ field: 'waiver.type', message: 'Could not determine waiver type from Yahoo response' })
  }

  return {
    ...league,
    leagueStatus: 'unknown',
    draft: draftInfo,
    waiver: { type: waiverInfo.type, faabBudget: waiverInfo.faabBudget, waiverDay: null, waiverHour: null },
    capabilities: YAHOO_CAPABILITIES,
    warnings,
  }
}
