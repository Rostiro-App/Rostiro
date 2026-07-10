import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { DemoStateProvider } from '../lib/DemoStateProvider'
import { DemoShell } from './DemoShell'

const wrap = () =>
  render(
    <DemoStateProvider autoplay={false}>
      <DemoShell><div>page-body</div></DemoShell>
    </DemoStateProvider>,
  )

describe('DemoShell (Rostiro OS chrome)', () => {
  it('renders the ROSTIRO OS wordmark and FOUNDER badge', () => {
    wrap()
    expect(screen.getByText('ROSTIRO')).toBeTruthy()
    expect(screen.getByText(/FOUNDER/)).toBeTruthy()
  })
  it('shows the real computed Health Score in the system bar', () => {
    wrap()
    expect(screen.getByTestId('health-score').textContent).toMatch(/^\d{1,3}$/)
  })
  it('renders the wrapped page body', () => {
    wrap()
    expect(screen.getByText('page-body')).toBeTruthy()
  })
})
