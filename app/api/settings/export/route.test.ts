import { describe, it, expect, vi } from 'vitest'

// A minimal chainable query-builder mock: every method returns `this` except
// the terminal ones (maybeSingle/order/then-via-await), which resolve to a
// configured { data, error } pair. Good enough for this route's actual
// call shapes without needing a real Supabase client.
function makeChainable(result: { data: unknown; error: unknown }) {
  const chain: Record<string, unknown> = {}
  const self = () => chain
  chain.select = vi.fn(self)
  chain.eq = vi.fn(self)
  chain.order = vi.fn(() => Promise.resolve(result))
  chain.maybeSingle = vi.fn(() => Promise.resolve(result))
  // Bare `await query` (no .order()/.maybeSingle() terminal call) — used
  // by the connected_leagues / usage_counters / push_subscriptions queries.
  chain.then = (resolve: (value: typeof result) => void) => resolve(result)
  return chain
}

function makeClient(tableResults: Record<string, { data: unknown; error: unknown }>) {
  return {
    from: vi.fn((table: string) => makeChainable(tableResults[table] ?? { data: null, error: null })),
  }
}

const baseTableResults = {
  users: { data: { email: 'a@b.com', plan: 'free' }, error: null },
  connected_leagues: { data: [], error: null },
  pulse_items: { data: [], error: null },
  ai_queries: { data: [], error: null },
  engagement_log: { data: [], error: null },
  usage_counters: { data: [], error: null },
  push_subscriptions: { data: [], error: null },
  espn_credentials: { data: null, error: null },
}

describe('GET /api/settings/export — Yahoo token custody', () => {
  it('reports yahoo connected via the ADMIN client, never the SSR (RLS-scoped) client', async () => {
    const ssrClient = makeClient(baseTableResults)
    const adminYahooResult = { data: { created_at: '2026-07-01T00:00:00Z' }, error: null }
    const adminClient = makeClient({ yahoo_tokens: adminYahooResult })

    vi.doMock('@/lib/supabase', () => ({
      createSSRClient: vi.fn(() => Promise.resolve({
        ...ssrClient,
        auth: { getUser: () => Promise.resolve({ data: { user: { id: 'user-1' } } }) },
      })),
      createAdminClient: vi.fn(() => adminClient),
    }))

    const { GET } = await import('./route')
    const res = await GET()
    const body = await res.json()

    expect(body.connectedPlatformCredentials.yahoo).toEqual({ connected: true, connectedAt: '2026-07-01T00:00:00Z' })
    // The SSR client's `from` must never have been called for yahoo_tokens —
    // proves the lookup went through admin, not the RLS-scoped session.
    expect(ssrClient.from).not.toHaveBeenCalledWith('yahoo_tokens')
    expect(adminClient.from).toHaveBeenCalledWith('yahoo_tokens')

    vi.doUnmock('@/lib/supabase')
    vi.resetModules()
  })

  it('reports yahoo not connected when the admin lookup finds no row', async () => {
    const ssrClient = makeClient(baseTableResults)
    const adminClient = makeClient({ yahoo_tokens: { data: null, error: null } })

    vi.doMock('@/lib/supabase', () => ({
      createSSRClient: vi.fn(() => Promise.resolve({
        ...ssrClient,
        auth: { getUser: () => Promise.resolve({ data: { user: { id: 'user-1' } } }) },
      })),
      createAdminClient: vi.fn(() => adminClient),
    }))

    const { GET } = await import('./route')
    const res = await GET()
    const body = await res.json()

    expect(body.connectedPlatformCredentials.yahoo).toEqual({ connected: false })

    vi.doUnmock('@/lib/supabase')
    vi.resetModules()
  })

  it('never includes yahoo_tokens ciphertext fields anywhere in the export payload', async () => {
    const ssrClient = makeClient(baseTableResults)
    const adminClient = makeClient({
      yahoo_tokens: {
        data: { created_at: '2026-07-01T00:00:00Z', access_token: 'should-never-appear', refresh_token: 'should-never-appear-either' },
        error: null,
      },
    })

    vi.doMock('@/lib/supabase', () => ({
      createSSRClient: vi.fn(() => Promise.resolve({
        ...ssrClient,
        auth: { getUser: () => Promise.resolve({ data: { user: { id: 'user-1' } } }) },
      })),
      createAdminClient: vi.fn(() => adminClient),
    }))

    const { GET } = await import('./route')
    const res = await GET()
    const rawBody = await res.text()

    expect(rawBody).not.toContain('should-never-appear')

    vi.doUnmock('@/lib/supabase')
    vi.resetModules()
  })
})
