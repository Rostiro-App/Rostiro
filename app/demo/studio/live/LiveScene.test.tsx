import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { LiveScene } from './LiveScene'
import { prefillLiveScenario } from '@/app/demo/lib/liveScenario'

describe('LiveScene', () => {
  const scenario = prefillLiveScenario()
  it('shows the calm/sweep OS early (MISSION CONTROL, no LIVE NOW yet)', () => {
    render(<LiveScene scenario={scenario} aspect="16:9" frame={30} />)
    expect(screen.getByText('MISSION CONTROL')).toBeTruthy()
    expect(screen.queryByText('Live now')).toBeNull()
  })
  it('shows the LIVE companion after it opens', () => {
    render(<LiveScene scenario={scenario} aspect="16:9" frame={400} />)
    expect(screen.getByText('Live now')).toBeTruthy()
    expect(screen.getByText(scenario.players[0].name)).toBeTruthy()
  })
})
