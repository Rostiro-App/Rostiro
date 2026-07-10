import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ConnectScene } from './ConnectScene'

describe('ConnectScene', () => {
  it('shows the connect screen before any league is connected (frame 40)', () => {
    render(<ConnectScene frame={40} />)
    expect(screen.getByText('Connect your leagues')).toBeTruthy()
    expect(screen.getByText('Sleeper')).toBeTruthy()
    expect(screen.getByText('Yahoo')).toBeTruthy()
    expect(screen.getByText('Unlock ESPN')).toBeTruthy()
    expect(screen.queryByText('Connected')).toBeNull()
  })

  it('shows Sleeper and Yahoo connected by frame 240 (before ESPN beat)', () => {
    render(<ConnectScene frame={240} />)
    expect(screen.getAllByText('Connected').length).toBeGreaterThan(0)
  })

  it('shows the unified multi-league feed once the cross-fade completes (frame 370)', () => {
    render(<ConnectScene frame={370} />)
    expect(screen.getByText('2 LEAGUES')).toBeTruthy()
  })

  it('caption states it is an interactive demo', () => {
    render(<ConnectScene frame={40} />)
    expect(screen.getByText(/interactive demo/i)).toBeTruthy()
  })
})
