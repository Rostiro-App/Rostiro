import { describe, it, expect } from 'vitest'
import { groupScratchedStartersByUser, scratchDedupeKey, resolveEffectiveInjury, formatScratchPush, type UserLeagueRoster, type ScratchedPlayer } from './scratchAlerts'

const scratched = new Map<string, ScratchedPlayer>([
  ['p1', { playerId: 'p1', playerName: 'Josh Allen', status: 'out' }],
])

describe('groupScratchedStartersByUser', () => {
  it('collapses one scratched starter across a user\'s leagues into ONE group', () => {
    const rosters: UserLeagueRoster[] = [
      { userId: 'u1', leagueId: 'L1', leagueName: 'Legends', starterIds: ['p1', 'p9'] },
      { userId: 'u1', leagueId: 'L2', leagueName: 'Money', starterIds: ['p1'] },
      { userId: 'u1', leagueId: 'L3', leagueName: 'Bench', starterIds: ['p9'] }, // p1 not a starter here
    ]
    const out = groupScratchedStartersByUser(rosters, scratched)
    expect(out.size).toBe(1)
    expect(out.get('u1')!.playerNames).toEqual(['Josh Allen'])
    expect(out.get('u1')!.leagueNames.sort()).toEqual(['Legends', 'Money'])
  })
  it('ignores scratched players who are on the bench (not starters)', () => {
    const rosters: UserLeagueRoster[] = [{ userId: 'u1', leagueId: 'L1', leagueName: 'Legends', starterIds: ['p9'] }]
    expect(groupScratchedStartersByUser(rosters, scratched).size).toBe(0)
  })
  it('keeps different users separate', () => {
    const rosters: UserLeagueRoster[] = [
      { userId: 'u1', leagueId: 'L1', leagueName: 'A', starterIds: ['p1'] },
      { userId: 'u2', leagueId: 'L2', leagueName: 'B', starterIds: ['p1'] },
    ]
    expect(groupScratchedStartersByUser(rosters, scratched).size).toBe(2)
  })
})

describe('scratchDedupeKey', () => {
  it('keys on player + status so escalation is a new key', () => {
    expect(scratchDedupeKey('p1', 'questionable')).toBe('scratch:p1:questionable')
    expect(scratchDedupeKey('p1', 'out')).toBe('scratch:p1:out')
  })
})

describe('resolveEffectiveInjury', () => {
  it('takes the most severe of Sleeper vs scratch', () => {
    expect(resolveEffectiveInjury('Questionable', 'out')).toBe('Out')
    expect(resolveEffectiveInjury('Out', 'questionable')).toBe('Out')
  })
  it('returns Sleeper status when no scratch', () => {
    expect(resolveEffectiveInjury('Doubtful', null)).toBe('Doubtful')
  })
  it('returns the scratch when Sleeper is clean', () => {
    expect(resolveEffectiveInjury(null, 'out')).toBe('Out')
  })
  it('returns null when both clean', () => {
    expect(resolveEffectiveInjury(null, null)).toBeNull()
  })
})

describe('formatScratchPush', () => {
  it('one player, one league', () => {
    expect(formatScratchPush(['Josh Allen'], ['Legends'])).toEqual({
      title: 'Josh Allen — ruled OUT',
      message: 'Josh Allen ruled out. Starting in Legends.',
    })
  })
  it('one player, multiple leagues uses +N others', () => {
    expect(formatScratchPush(['Josh Allen'], ['Legends', 'Money', 'Dynasty'])).toEqual({
      title: 'Josh Allen — ruled OUT',
      message: 'Josh Allen ruled out. Starting in Legends +2 others.',
    })
  })
  it('multiple players', () => {
    expect(formatScratchPush(['Josh Allen', 'Bijan Robinson'], ['Legends', 'Money'])).toEqual({
      title: '2 starters ruled OUT',
      message: 'Josh Allen, Bijan Robinson ruled out. Starting in Legends +1 other.',
    })
  })
})
