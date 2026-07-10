import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { StudioCanvas } from './StudioCanvas'
import { defaultInterruptEvent } from '../lib/simEvents'

describe('StudioCanvas', () => {
  it('renders the OS chrome with no event', () => {
    render(<StudioCanvas event={null} aspect="16:9" />)
    expect(screen.getByText('ROSTIRO')).toBeTruthy()
  })
  it('overlays the interrupt card when an event with metrics is fired', () => {
    const e = { ...defaultInterruptEvent(), eventLabel: 'TOUCHDOWN', playerLine: 'Amon-Ra · WR · DET',
      metrics: [{ leagueName: 'Sunday Money', label: 'Win Prob', value: '+22%', deltaPositive: true }] }
    render(<StudioCanvas event={e} aspect="16:9" />)
    expect(screen.getByText('Amon-Ra · WR · DET')).toBeTruthy()
    expect(screen.getByText('+22%')).toBeTruthy()
  })
})
