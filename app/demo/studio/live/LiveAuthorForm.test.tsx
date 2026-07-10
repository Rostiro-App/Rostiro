import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { LiveAuthorForm } from './LiveAuthorForm'
import { prefillLiveScenario } from '@/app/demo/lib/liveScenario'

describe('LiveAuthorForm', () => {
  it('editing a player name and a matchup oppFinal propagates via onChange', () => {
    const sc = prefillLiveScenario()
    const onChange = vi.fn()
    render(<LiveAuthorForm content={sc} onChange={onChange} />)
    fireEvent.change(screen.getByDisplayValue(sc.players[0].name), { target: { value: 'Custom Star' } })
    expect(onChange.mock.calls.at(-1)![0].players[0].name).toBe('Custom Star')
    fireEvent.change(screen.getByDisplayValue(String(sc.matchups[0].oppFinal)), { target: { value: '99' } })
    expect(onChange.mock.calls.at(-1)![0].matchups[0].oppFinal).toBe(99)
  })
})
