import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { DemoStateProvider } from './lib/DemoStateProvider'
import { DemoTour } from './page'

describe('DemoTour', () => {
  it('renders the Standard state surface by default', () => {
    render(<DemoStateProvider autoplay={false}><DemoTour consoleVisible={false} /></DemoStateProvider>)
    expect(screen.getByText(/Standings/)).toBeTruthy()
  })
})
