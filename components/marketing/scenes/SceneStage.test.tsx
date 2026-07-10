import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { SceneStage } from './SceneStage'

describe('SceneStage', () => {
  it('renders children at the forced frame and shows the caption', () => {
    render(
      <SceneStage durationFrames={100} caption="hello caption" frame={42}>
        {(frame) => <span data-testid="f">{frame}</span>}
      </SceneStage>,
    )
    expect(screen.getByTestId('f').textContent).toBe('42')
    expect(screen.getByText('hello caption')).toBeTruthy()
  })
})
