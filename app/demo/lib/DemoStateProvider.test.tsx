import { describe, it, expect } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { DemoStateProvider, useDemo } from './DemoStateProvider'

function Probe() {
  const { state, controls } = useDemo()
  return (
    <div>
      <span data-testid="state">{state.currentState}</span>
      <button onClick={() => controls.jumpToState('game_day')}>jump</button>
    </div>
  )
}

describe('DemoStateProvider', () => {
  it('starts in the timeline initial state', () => {
    render(<DemoStateProvider autoplay={false}><Probe /></DemoStateProvider>)
    expect(screen.getByTestId('state').textContent).toBe('standard')
  })
  it('jumpToState overrides current state immediately', () => {
    render(<DemoStateProvider autoplay={false}><Probe /></DemoStateProvider>)
    act(() => { screen.getByText('jump').click() })
    expect(screen.getByTestId('state').textContent).toBe('game_day')
  })
})
