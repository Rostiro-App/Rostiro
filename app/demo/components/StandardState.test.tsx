import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { DemoStateProvider } from '../lib/DemoStateProvider'
import { StandardState } from './StandardState'

describe('StandardState', () => {
  it('shows the founder team and a numeric Health Score', () => {
    render(<DemoStateProvider autoplay={false}><StandardState /></DemoStateProvider>)
    expect(screen.getByText(/Lawrence's Legends/)).toBeTruthy()
    // Health Score card renders a number 0-100
    expect(screen.getByTestId('health-score').textContent).toMatch(/^\d{1,3}$/)
  })
})
