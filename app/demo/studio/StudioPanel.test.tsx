import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { StudioPanel } from './StudioPanel'
import { defaultInterruptEvent } from '../lib/simEvents'

describe('StudioPanel', () => {
  it('filters the player search and prefills metrics on select', () => {
    let ev = defaultInterruptEvent()
    const onChange = vi.fn((e) => { ev = e })
    render(<StudioPanel state="game_day" onState={() => {}} event={ev} onChange={onChange} onFire={() => {}} packContent={null} onPackChange={() => {}} />)
    fireEvent.change(screen.getByPlaceholderText(/search player/i), { target: { value: 'Lamar' } })
    const opt = screen.getByText(/Lamar Jackson/)
    fireEvent.click(opt)
    // onChange called with a playerLine + prefilled metrics
    const last = onChange.mock.calls.at(-1)![0]
    expect(last.playerLine).toMatch(/Lamar Jackson/)
    expect(last.metrics.length).toBeGreaterThan(0)
  })
  it('lets the operator rename a league and change a metric label', () => {
    const withMetric = { ...defaultInterruptEvent(), metrics: [{ leagueName: 'Sunday Money', label: 'Win Prob', value: '+22%', deltaPositive: true }] }
    const onChange = vi.fn()
    render(<StudioPanel state="game_day" onState={() => {}} event={withMetric} onChange={onChange} onFire={() => {}} packContent={null} onPackChange={() => {}} />)
    fireEvent.change(screen.getByDisplayValue('Sunday Money'), { target: { value: 'Bench Regret FC' } })
    expect(onChange.mock.calls.at(-1)![0].metrics[0].leagueName).toBe('Bench Regret FC')
    fireEvent.change(screen.getByDisplayValue('Win Prob'), { target: { value: 'Pain Index' } })
    expect(onChange.mock.calls.at(-1)![0].metrics[0].label).toBe('Pain Index')
  })
})
