import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import FaqPage from './page'

// Packet 02 correction pass: the FAQ page previously told real users
// "Yahoo is the one platform where Rostiro can submit a lineup, waiver
// claim, or trade proposal directly" — false, and live in production.
// This is a static assertion that no write-access claim can silently
// creep back into this page's copy.

// Specific enough to only match the OLD, affirmative write-access claims
// — not the corrected copy's own negated sentence ("doesn't submit a
// lineup, claim a waiver, or propose a trade"), which legitimately
// contains the same words in the opposite sense.
const WRITE_ACCESS_PHRASES = [
  'Rostiro can submit',
  'Rostiro can also set your lineup',
  "Yahoo's API supports that",
  'Yahoo is the one platform where Rostiro can',
  'Full read + write',
  'Full read and write',
]

describe('FAQ page — no Yahoo write-access claims', () => {
  it('never renders a phrase implying Rostiro can write to any platform', () => {
    const { container } = render(<FaqPage />)
    container.querySelector('script[type="application/ld+json"]')?.remove()
    const text = container.textContent ?? ''
    for (const phrase of WRITE_ACCESS_PHRASES) {
      expect(text).not.toContain(phrase)
    }
  })

  it('states plainly that all three platform connections are read-only', () => {
    const { container } = render(<FaqPage />)
    container.querySelector('script[type="application/ld+json"]')?.remove()
    const text = container.textContent ?? ''
    expect(text).toMatch(/read-only/i)
  })

  it('never emits a write-access claim in the FAQPage structured data either', () => {
    const { container } = render(<FaqPage />)
    const script = container.querySelector('script[type="application/ld+json"]')
    const json = script?.innerHTML ?? ''
    for (const phrase of WRITE_ACCESS_PHRASES) {
      expect(json).not.toContain(phrase)
    }
  })
})
