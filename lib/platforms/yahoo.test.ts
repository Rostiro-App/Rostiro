import { describe, it, expect } from 'vitest'
import { YAHOO_CAPABILITIES } from './yahoo'

describe('YAHOO_CAPABILITIES', () => {
  it('declares all three write capabilities false — Yahoo has approved read access only', () => {
    expect(YAHOO_CAPABILITIES.lineupWrite).toBe(false)
    expect(YAHOO_CAPABILITIES.waiverWrite).toBe(false)
    expect(YAHOO_CAPABILITIES.tradeWrite).toBe(false)
  })

  it('declares the read capabilities Rostiro actually uses today', () => {
    expect(YAHOO_CAPABILITIES.leagueRead).toBe(true)
    expect(YAHOO_CAPABILITIES.rosterRead).toBe(true)
    expect(YAHOO_CAPABILITIES.matchupRead).toBe(true)
    expect(YAHOO_CAPABILITIES.draftRead).toBe(true)
    expect(YAHOO_CAPABILITIES.freeAgentRead).toBe(true)
  })
})
