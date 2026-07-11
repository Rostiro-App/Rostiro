import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PushLockScreen } from './PushLockScreen'
import { defaultPushMoment } from '@/app/demo/lib/pushMoment'

describe('PushLockScreen', () => {
  it('renders the notification title, body, app name, and clock', () => {
    const m = defaultPushMoment()
    render(<PushLockScreen content={m} aspect="9:16" />)
    expect(screen.getByText(m.title)).toBeTruthy()
    expect(screen.getByText(m.body)).toBeTruthy()
    expect(screen.getAllByText(m.clockTime).length).toBeGreaterThan(0)
    expect(screen.getByText(/ROSTIRO/i)).toBeTruthy()
  })
  it('renders without crashing in 16:9 (centered phone)', () => {
    render(<PushLockScreen content={defaultPushMoment()} aspect="16:9" />)
    expect(screen.getByText(defaultPushMoment().title)).toBeTruthy()
  })
})
