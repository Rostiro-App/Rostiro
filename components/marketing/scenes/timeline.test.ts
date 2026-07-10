import { describe, it, expect } from 'vitest'
import { interpolate, inRange, progress } from './timeline'

describe('interpolate', () => {
  it('maps the start and end frames to the output range', () => {
    expect(interpolate(0, [0, 10], [0, 100])).toBe(0)
    expect(interpolate(10, [0, 10], [0, 100])).toBe(100)
    expect(interpolate(5, [0, 10], [0, 100])).toBe(50)
  })
  it('clamps outside the input range by default', () => {
    expect(interpolate(-5, [0, 10], [0, 100])).toBe(0)
    expect(interpolate(20, [0, 10], [0, 100])).toBe(100)
  })
})

describe('inRange', () => {
  it('is inclusive of start, exclusive of end', () => {
    expect(inRange(5, 5, 10)).toBe(true)
    expect(inRange(10, 5, 10)).toBe(false)
    expect(inRange(4, 5, 10)).toBe(false)
  })
})

describe('progress', () => {
  it('is 0 at start, 1 at end, clamped outside', () => {
    expect(progress(5, 5, 15)).toBe(0)
    expect(progress(15, 5, 15)).toBe(1)
    expect(progress(0, 5, 15)).toBe(0)
    expect(progress(100, 5, 15)).toBe(1)
  })
})
