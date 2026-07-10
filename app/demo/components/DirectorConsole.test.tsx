import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { DemoStateProvider } from '../lib/DemoStateProvider'
import { DirectorConsole } from './DirectorConsole'

const wrap = (visible: boolean) =>
  render(<DemoStateProvider autoplay={false}><DirectorConsole visible={visible} /></DemoStateProvider>)

describe('DirectorConsole', () => {
  it('renders nothing when not visible', () => {
    const { container } = wrap(false)
    expect(container.textContent).toBe('')
  })
  it('renders 5 jump-to-state buttons when visible', () => {
    wrap(true)
    for (const s of ['Draft', 'Standard', 'Waiver', 'Game', 'Film']) {
      expect(screen.getByRole('button', { name: new RegExp(s, 'i') })).toBeTruthy()
    }
  })
})
