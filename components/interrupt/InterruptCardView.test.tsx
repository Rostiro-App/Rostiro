import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { InterruptCardView } from './InterruptCardView'

describe('InterruptCardView', () => {
  it('renders the plain card (no metrics) like the live interrupt', () => {
    render(<InterruptCardView typeLabel="TOUCHDOWN" headline="Josh Allen — TD" reasoning="+6.0 to your live score" color="var(--signal)" priority="info" />)
    expect(screen.getByText('TOUCHDOWN')).toBeTruthy()
    expect(screen.getByText('Josh Allen — TD')).toBeTruthy()
    expect(screen.getByText('+6.0 to your live score')).toBeTruthy()
    expect(screen.queryByText('Snooze')).toBeNull() // non-critical
  })
  it('shows Snooze/✕ only for critical', () => {
    render(<InterruptCardView typeLabel="LINEUP LOCK" headline="x" reasoning="y" color="var(--crit)" priority="critical" onSnooze={() => {}} onDismiss={() => {}} />)
    expect(screen.getByText('Snooze')).toBeTruthy()
  })
  it('renders the hero cross-league metrics when provided', () => {
    render(
      <InterruptCardView typeLabel="TOUCHDOWN" headline="Amon-Ra · WR · DET" reasoning="" color="var(--crit)" priority="info"
        metrics={[
          { leagueName: "Lawrence's Legends", label: 'Win Prob', value: '+18%', deltaPositive: true },
          { leagueName: 'Bench Regret FC', label: 'Pain Index', value: '94%' },
        ]} />,
    )
    expect(screen.getByText('+18%')).toBeTruthy()
    expect(screen.getByText(/2 OF YOUR LEAGUES/)).toBeTruthy()
    expect(screen.getByText('Bench Regret FC')).toBeTruthy()
    expect(screen.getByText('Pain Index')).toBeTruthy()
  })
})
