import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { DemoStateProvider } from '../lib/DemoStateProvider'
import { StandardState } from './StandardState'

describe('StandardState (Pulse feed)', () => {
  it('renders a time-of-day greeting for the founder', () => {
    render(<DemoStateProvider autoplay={false}><StandardState /></DemoStateProvider>)
    expect(screen.getByRole('heading', { name: /Good (morning|afternoon|evening), Lawrence\./ })).toBeTruthy()
  })
  it('shows a decision count line', () => {
    render(<DemoStateProvider autoplay={false}><StandardState /></DemoStateProvider>)
    expect(
      screen.getByText((_, el) => el?.tagName === 'P' && /decisions? across 1 league/.test(el.textContent ?? '')),
    ).toBeTruthy()
  })
  it('renders real decision cards with a WAIVER tag', () => {
    render(<DemoStateProvider autoplay={false}><StandardState /></DemoStateProvider>)
    expect(screen.getByText('WAIVER')).toBeTruthy()
    // At least one card headline about an unrostered free agent (real Health signal)
    expect(screen.getByText(/unrostered/)).toBeTruthy()
  })
})
