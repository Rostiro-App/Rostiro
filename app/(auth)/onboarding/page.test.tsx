import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'

// Packet 02 correction pass regression test: a successful Yahoo OAuth
// callback used to land back on "/onboarding" with no "?yahoo=connected"
// handling at all, which meant the full-page-reload remount defaulted
// straight to the mode-selection step — silently discarding a completed
// (or in-progress) Yahoo connection. This proves "?yahoo=importing" lands
// on the 'yahoo' step instead.

const replace = vi.fn()

function mockSearchParams(params: Record<string, string>) {
  vi.doMock('next/navigation', () => ({
    useRouter: () => ({ replace, push: vi.fn() }),
    useSearchParams: () => new URLSearchParams(params),
  }))
}

vi.mock('@/components/onboarding/ModeSelection', () => ({
  default: ({ onContinue }: { onContinue: () => void }) => (
    <button onClick={onContinue}>MODE_SELECTION_MARKER</button>
  ),
}))
vi.mock('@/components/onboarding/SleeperConnect', () => ({ default: () => <div>SleeperConnect</div> }))
vi.mock('@/components/onboarding/EspnConnect', () => ({ default: () => <div>EspnConnect</div> }))
vi.mock('@/components/onboarding/YahooConnect', () => ({
  default: ({ startImporting }: { startImporting?: boolean }) => (
    <div>YahooConnect startImporting={String(!!startImporting)}</div>
  ),
}))

describe('OnboardingPage — Yahoo OAuth return handling', () => {
  beforeEach(() => {
    vi.resetModules()
    replace.mockClear()
  })

  it('lands on the yahoo step (not mode selection) when returning with ?yahoo=importing', async () => {
    mockSearchParams({ yahoo: 'importing' })
    const { default: OnboardingPage } = await import('./page')
    render(<OnboardingPage />)

    expect(screen.queryByText('MODE_SELECTION_MARKER')).toBeNull()
    expect(screen.getByText('YahooConnect startImporting=true')).toBeTruthy()
  })

  it('still lands on mode selection for a completely fresh visit (no params)', async () => {
    mockSearchParams({})
    const { default: OnboardingPage } = await import('./page')
    render(<OnboardingPage />)

    expect(screen.getByText('MODE_SELECTION_MARKER')).toBeTruthy()
  })

  it('lands on the connect step (with the error surfaced) for a failed connection, same as before', async () => {
    mockSearchParams({ error: 'yahoo_auth_failed' })
    const { default: OnboardingPage } = await import('./page')
    render(<OnboardingPage />)

    expect(screen.queryByText('MODE_SELECTION_MARKER')).toBeNull()
    expect(screen.getByText('Yahoo connection failed. Please try again.')).toBeTruthy()
  })
})
