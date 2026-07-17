import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import * as yahoo from './yahoo'

// Packet 02, Section 9: static assertion that the Yahoo client exposes
// only approved read operations. Yahoo has approved Rostiro for read
// access only — no lineup/waiver/trade write function should exist, and
// no call into the Fantasy Sports API resource fetcher (yahooFetch) should
// ever use a mutation HTTP method.

describe('lib/yahoo.ts exposes no write operations', () => {
  it('does not export any lineup/waiver/trade submission function', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((yahoo as any).submitYahooLineup).toBeUndefined()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((yahoo as any).submitYahooWaiverClaim).toBeUndefined()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((yahoo as any).proposeYahooTrade).toBeUndefined()
  })

  it('the Fantasy Sports resource fetcher (everything past the OAuth token exchange) never uses a mutation HTTP method', () => {
    const source = readFileSync(join(__dirname, 'yahoo.ts'), 'utf-8')
    const fetcherSectionStart = source.indexOf('// ─── Core API fetcher')
    expect(fetcherSectionStart).toBeGreaterThan(-1)
    const fetcherSection = source.slice(fetcherSectionStart)

    // The OAuth token endpoint (exchangeYahooCode/refreshYahooTokens, both
    // BEFORE this section) legitimately POSTs to YAHOO_TOKEN_URL — that's
    // the standard OAuth2 token-exchange method, not a Fantasy Sports
    // resource mutation, so it's deliberately excluded from this check by
    // slicing from the fetcher section onward.
    expect(fetcherSection).not.toMatch(/method:\s*['"]PUT['"]/)
    expect(fetcherSection).not.toMatch(/method:\s*['"]POST['"]/)
  })

  it('no XML request-body builder exists (was only used by the removed write functions)', () => {
    const source = readFileSync(join(__dirname, 'yahoo.ts'), 'utf-8')
    expect(source).not.toMatch(/function buildLineupXml/)
    expect(source).not.toMatch(/function buildWaiverXml/)
    expect(source).not.toMatch(/function buildTradeXml/)
  })
})
