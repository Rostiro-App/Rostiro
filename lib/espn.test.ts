import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/observability', () => ({
  checkCircuitBreaker: vi.fn(() => Promise.resolve()),
  recordApiCall: vi.fn(() => Promise.resolve()),
}))

const credentials = { espnS2: 's2', swid: 'swid' }

function mockFetchOnce(body: unknown) {
  return vi.fn((_url: string, _init: RequestInit) => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body) } as Response))
}

describe('espnFetch filter header (P3-4B regression)', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.unstubAllGlobals()
  })

  it('getEspnWaivers sends the real filter as the X-Fantasy-Filter HEADER, not a dead query-string param', async () => {
    const fetchSpy = mockFetchOnce({ players: [] })
    vi.stubGlobal('fetch', fetchSpy)

    const { getEspnWaivers } = await import('./espn')
    await getEspnWaivers('12345', credentials)

    expect(fetchSpy).toHaveBeenCalledTimes(1)
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit]
    const headerFilter = JSON.parse((init.headers as Record<string, string>)['X-Fantasy-Filter'])
    expect(headerFilter.players.filterStatus.value).toEqual(['FREEAGENT', 'WAIVERS'])
    expect(headerFilter.players.limit).toBe(50)
    // The bug this regresses against: the filter used to only ever appear
    // (uselessly) in the URL's query string, never the header.
    expect(new URL(url).searchParams.has('X-Fantasy-Filter')).toBe(false)
  })

  it('a call with no explicit filter still sends the safe empty-object default header', async () => {
    const fetchSpy = mockFetchOnce({ settings: {} })
    vi.stubGlobal('fetch', fetchSpy)

    const { validateEspnCredentials } = await import('./espn')
    await validateEspnCredentials('12345', credentials)

    const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit]
    expect((init.headers as Record<string, string>)['X-Fantasy-Filter']).toBe('{}')
  })
})

describe('getEspnAllPlayers pagination', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.unstubAllGlobals()
  })

  it('stops once a page returns fewer than pageSize results', async () => {
    let call = 0
    const fetchSpy = vi.fn(() => {
      call++
      const players = call === 1 ? Array.from({ length: 3 }, (_, i) => ({ id: i })) : Array.from({ length: 2 }, (_, i) => ({ id: 100 + i }))
      return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ players }) } as Response)
    })
    vi.stubGlobal('fetch', fetchSpy)

    const { getEspnAllPlayers } = await import('./espn')
    const result = await getEspnAllPlayers('12345', credentials, { pageSize: 3, maxPages: 10 })

    expect(fetchSpy).toHaveBeenCalledTimes(2)
    expect(result.players).toHaveLength(5)
    expect(result.pagesFetched).toBe(2)
    expect(result.hitMaxPages).toBe(false)
  })

  it('sends increasing offsets on each page via the real filter header', async () => {
    const offsetsSeen: number[] = []
    const fetchSpy = vi.fn((_url: string, init: RequestInit) => {
      const filter = JSON.parse((init.headers as Record<string, string>)['X-Fantasy-Filter'])
      offsetsSeen.push(filter.players.offset)
      const players = offsetsSeen.length <= 2 ? Array.from({ length: 2 }, (_, i) => ({ id: i })) : []
      return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ players }) } as Response)
    })
    vi.stubGlobal('fetch', fetchSpy)

    const { getEspnAllPlayers } = await import('./espn')
    await getEspnAllPlayers('12345', credentials, { pageSize: 2, maxPages: 10 })

    expect(offsetsSeen).toEqual([0, 2, 4])
  })

  it('reports hitMaxPages honestly instead of silently truncating', async () => {
    const fetchSpy = vi.fn(() =>
      Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ players: [{ id: 1 }, { id: 2 }] }) } as Response)
    )
    vi.stubGlobal('fetch', fetchSpy)

    const { getEspnAllPlayers } = await import('./espn')
    const result = await getEspnAllPlayers('12345', credentials, { pageSize: 2, maxPages: 3 })

    expect(fetchSpy).toHaveBeenCalledTimes(3)
    expect(result.hitMaxPages).toBe(true)
  })
})
