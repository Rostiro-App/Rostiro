import { describe, it, expect } from 'vitest'
import { classifyScratch } from './scratchClassifier'

describe('classifyScratch', () => {
  it('flags "ruled out" as high-confidence out', () => {
    expect(classifyScratch('Josh Allen ruled out for Week 1', null)).toEqual({ status: 'out', confidence: 'high' })
  })
  it('flags "inactive" as high-confidence out', () => {
    expect(classifyScratch('Bijan Robinson inactive', 'Falcons announce inactives')).toEqual({ status: 'out', confidence: 'high' })
  })
  it('flags "will not play" as high-confidence out', () => {
    expect(classifyScratch('Report: CMC will not play Sunday', null)).toEqual({ status: 'out', confidence: 'high' })
  })
  it('flags "doubtful" as medium-confidence doubtful', () => {
    expect(classifyScratch('Star WR doubtful with hamstring', null)).toEqual({ status: 'doubtful', confidence: 'medium' })
  })
  it('flags "questionable" as medium-confidence questionable', () => {
    expect(classifyScratch('RB questionable, limited in practice', null)).toEqual({ status: 'questionable', confidence: 'medium' })
  })
  it('prefers high over medium when both present', () => {
    expect(classifyScratch('Was questionable, now ruled out', null)).toEqual({ status: 'out', confidence: 'high' })
  })
  it('returns null for reversal/positive language', () => {
    expect(classifyScratch('QB will play, upgraded to active', null)).toBeNull()
    expect(classifyScratch('WR expected to play, cleared from injury report', null)).toBeNull()
  })
  it('returns high-confidence out when reversal language co-occurs with a ruled-out phrase', () => {
    expect(classifyScratch('Was active in warmups but has been ruled out', null)).toEqual({ status: 'out', confidence: 'high' })
  })
  it('returns null when no injury language', () => {
    expect(classifyScratch('Chiefs sign veteran to practice squad', null)).toBeNull()
  })
  it('does not false-match on substrings', () => {
    expect(classifyScratch('An outstanding performance in questionably cold weather', null)).toBeNull()
  })
  it('is case-insensitive', () => {
    expect(classifyScratch('PLAYER RULED OUT', null)).toEqual({ status: 'out', confidence: 'high' })
  })
})
