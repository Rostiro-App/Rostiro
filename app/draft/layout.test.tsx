// Packet 3.5-4B — the Draft layout, when it hands a logged-in user the full
// AppShell, must follow the SAME server-resolved SimulationPanel rule as the
// dashboard layout: enableSimulation computed from the authenticated user id.

import { describe, it, expect, vi, afterEach } from 'vitest'
import type { ReactElement } from 'react'

vi.mock('@/lib/supabase', () => ({ createSSRClient: vi.fn() }))

import { createSSRClient } from '@/lib/supabase'
import AppShell from '@/components/nav/AppShell'
import DraftLayout from './layout'

const ADMIN_ID = '11111111-1111-1111-1111-111111111111'
const OTHER_ID = '22222222-2222-2222-2222-222222222222'

function withUser(user: { id: string } | null) {
  vi.mocked(createSSRClient).mockResolvedValue({
    auth: { getUser: () => Promise.resolve({ data: { user } }) },
  } as never)
}

describe('DraftLayout — server-resolved enableSimulation for logged-in users (P3.5-4B)', () => {
  const original = process.env.ADMIN_USER_ID
  afterEach(() => {
    process.env.ADMIN_USER_ID = original
    vi.restoreAllMocks()
  })

  it('a logged-in non-admin gets AppShell with enableSimulation=false', async () => {
    process.env.ADMIN_USER_ID = ADMIN_ID
    withUser({ id: OTHER_ID })
    const el = (await DraftLayout({ children: null })) as ReactElement<{ enableSimulation: boolean }>
    expect(el.type).toBe(AppShell)
    expect(el.props.enableSimulation).toBe(false)
  })

  it('a logged-in admin gets AppShell with enableSimulation=true', async () => {
    process.env.ADMIN_USER_ID = ADMIN_ID
    withUser({ id: ADMIN_ID })
    const el = (await DraftLayout({ children: null })) as ReactElement<{ enableSimulation: boolean }>
    expect(el.type).toBe(AppShell)
    expect(el.props.enableSimulation).toBe(true)
  })

  it('an anonymous visitor does not get AppShell at all', async () => {
    withUser(null)
    const el = (await DraftLayout({ children: null })) as ReactElement
    expect(el.type).not.toBe(AppShell)
  })
})
