import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { DemoStateProvider } from './lib/DemoStateProvider'
import { DemoTour } from './page'

describe('DemoTour', () => {
  it('renders the OS shell with the Pulse feed by default', () => {
    render(<DemoStateProvider autoplay={false}><DemoTour consoleVisible={false} /></DemoStateProvider>)
    // Chrome
    expect(screen.getByText('ROSTIRO')).toBeTruthy()
    // Standard-state surface: the greeting
    expect(screen.getByRole('heading', { name: /Good (morning|afternoon|evening)/ })).toBeTruthy()
  })
})
