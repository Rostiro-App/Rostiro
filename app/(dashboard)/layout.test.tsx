// Packet 3.5-4B — dashboard layout computes the SimulationPanel capability
// server-side from the authenticated user id (real isAdminUserId, real
// AppShell element) and passes only the boolean. We inspect the returned
// element's props rather than rendering AppShell (rendering the shell is
// covered in components/nav/AppShell.test.tsx).

import { describe, it, expect, vi, afterEach } from 'vitest'
import type { ReactElement } from 'react'

vi.mock('@/lib/supabase', () => ({ createSSRClient: vi.fn() }))
vi.mock('next/navigation', () => ({ redirect: vi.fn(() => { throw new Error('REDIRECT') }) }))

import { createSSRClient } from '@/lib/supabase'
import DashboardLayout from './layout'

const ADMIN_ID = '11111111-1111-1111-1111-111111111111'
const OTHER_ID = '22222222-2222-2222-2222-222222222222'

function withUser(user: { id: string } | null) {
  vi.mocked(createSSRClient).mockResolvedValue({
    auth: { getUser: () => Promise.resolve({ data: { user } }) },
  } as never)
}

describe('DashboardLayout — server-resolved enableSimulation (P3.5-4B)', () => {
  const original = process.env.ADMIN_USER_ID
  afterEach(() => {
    process.env.ADMIN_USER_ID = original
    vi.restoreAllMocks()
  })

  it('passes enableSimulation=false for an authenticated non-admin user', async () => {
    process.env.ADMIN_USER_ID = ADMIN_ID
    withUser({ id: OTHER_ID })
    const el = (await DashboardLayout({ children: null })) as ReactElement<{ enableSimulation: boolean }>
    expect(el.props.enableSimulation).toBe(false)
  })

  it('passes enableSimulation=true for the configured admin user', async () => {
    process.env.ADMIN_USER_ID = ADMIN_ID
    withUser({ id: ADMIN_ID })
    const el = (await DashboardLayout({ children: null })) as ReactElement<{ enableSimulation: boolean }>
    expect(el.props.enableSimulation).toBe(true)
  })

  it('fails closed (enableSimulation=false) when ADMIN_USER_ID is unconfigured', async () => {
    delete process.env.ADMIN_USER_ID
    withUser({ id: ADMIN_ID })
    const el = (await DashboardLayout({ children: null })) as ReactElement<{ enableSimulation: boolean }>
    expect(el.props.enableSimulation).toBe(false)
  })
})
