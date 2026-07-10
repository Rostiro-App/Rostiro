import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { waiverPack } from './waiverPack'

describe('waiverPack', () => {
  it('prefills real waiver targets from the fixture', () => {
    const c = waiverPack.prefill()
    expect(c.targets.length).toBeGreaterThanOrEqual(1)
    expect(c.targets[0].name.length).toBeGreaterThan(0)
    expect(typeof c.targets[0].faabSuggestion).toBe('number')
  })
  it('FullSurface renders the Mission Briefing framing + a WAIVER card per target', () => {
    const c = waiverPack.prefill()
    render(<waiverPack.FullSurface content={c} />)
    expect(screen.getByText('MISSION BRIEFING')).toBeTruthy()
    expect(screen.getByText(/priority waiver target/)).toBeTruthy()
    expect(screen.getAllByText('WAIVER').length).toBe(c.targets.length)
  })
})
