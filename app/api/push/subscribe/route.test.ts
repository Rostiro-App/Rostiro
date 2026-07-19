// P3.5-4C correction: server-authoritative push registration boundary.
//
// The real Supabase is never contacted. A small chainable query-builder mock
// records every operation (table / op / eq / neq / count / payload) and a
// per-test resolver returns the {data,error,count} each terminal await sees.
// The properties under test: auth is required; push_enabled is derived only
// from a successfully persisted subscription; a DB error short-circuits to 500
// before anything is enabled; DELETE removes only the current device and
// re-derives the kill switch from what remains; and a browser subscription is
// reassigned away from a prior user on account switch.

import { describe, it, expect, vi, beforeEach } from 'vitest'

let currentUser: { id: string } | null = { id: 'user-1' }
let resolver: (op: RecordedOp) => { data?: unknown; error?: unknown; count?: number }
let calls: RecordedOp[] = []

interface RecordedOp {
  table: string
  op: 'select' | 'delete' | 'update' | 'upsert' | ''
  count: boolean
  eqs: [string, unknown][]
  neqs: [string, unknown][]
  payload?: unknown
}

function makeBuilder(table: string) {
  const ctx: RecordedOp = { table, op: '', count: false, eqs: [], neqs: [] }
  const builder = {
    select(_cols?: string, opts?: { count?: string; head?: boolean }) {
      ctx.op = 'select'
      if (opts?.count) ctx.count = true
      return builder
    },
    delete() { ctx.op = 'delete'; return builder },
    update(payload: unknown) { ctx.op = 'update'; ctx.payload = payload; return builder },
    upsert(payload: unknown) { ctx.op = 'upsert'; ctx.payload = payload; return builder },
    eq(col: string, val: unknown) { ctx.eqs.push([col, val]); return builder },
    neq(col: string, val: unknown) { ctx.neqs.push([col, val]); return builder },
    then(onFulfilled: (v: unknown) => unknown, onRejected?: (e: unknown) => unknown) {
      calls.push(ctx)
      return Promise.resolve(resolver(ctx)).then(onFulfilled, onRejected)
    },
  }
  return builder
}

vi.mock('@/lib/supabase', () => ({
  createSSRClient: vi.fn(async () => ({
    auth: { getUser: async () => ({ data: { user: currentUser } }) },
  })),
  createAdminClient: vi.fn(() => ({ from: (table: string) => makeBuilder(table) })),
}))

import { POST, DELETE } from './route'

function req(method: string, body: unknown) {
  return new Request('http://localhost/api/push/subscribe', {
    method,
    body: JSON.stringify(body),
  }) as never
}

beforeEach(() => {
  currentUser = { id: 'user-1' }
  calls = []
  resolver = () => ({ error: null })
})

function find(pred: (op: RecordedOp) => boolean) {
  return calls.find(pred)
}

describe('POST /api/push/subscribe (P3.5-4C server-authoritative)', () => {
  it('unauthorized POST fails with 401', async () => {
    currentUser = null
    const res = await POST(req('POST', { subscriptionId: 'sub-1' }))
    expect(res.status).toBe(401)
  })

  it('rejects a missing/oversized subscriptionId with 400', async () => {
    const res1 = await POST(req('POST', {}))
    expect(res1.status).toBe(400)
    const res2 = await POST(req('POST', { subscriptionId: 'x'.repeat(256) }))
    expect(res2.status).toBe(400)
  })

  it('enables the user only after the subscription upsert succeeds', async () => {
    resolver = (op) => {
      if (op.table === 'push_subscriptions' && op.op === 'select' && !op.count) return { data: [] }
      return { error: null, count: 0 }
    }
    const res = await POST(req('POST', { subscriptionId: 'sub-1' }))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ subscribed: true })

    const upsert = find((o) => o.table === 'push_subscriptions' && o.op === 'upsert')
    expect(upsert?.payload).toMatchObject({ user_id: 'user-1', onesignal_player_id: 'sub-1' })
    const enable = find((o) => o.table === 'users' && o.op === 'update')
    expect(enable?.payload).toEqual({ push_enabled: true })
  })

  it('a failed upsert returns 500 and never enables the user', async () => {
    resolver = (op) => {
      if (op.table === 'push_subscriptions' && op.op === 'select' && !op.count) return { data: [] }
      if (op.table === 'push_subscriptions' && op.op === 'upsert') return { error: { message: 'db down' } }
      return { error: null }
    }
    const res = await POST(req('POST', { subscriptionId: 'sub-1' }))
    expect(res.status).toBe(500)
    // push_enabled must never have been set true on the failing path.
    const enable = find((o) => o.table === 'users' && o.op === 'update')
    expect(enable).toBeUndefined()
  })

  it('reassigns the subscription away from a prior user on account switch', async () => {
    resolver = (op) => {
      if (op.table === 'push_subscriptions' && op.op === 'select' && !op.count) {
        // a *different* user currently owns this browser subscription
        return { data: [{ user_id: 'user-2' }] }
      }
      if (op.table === 'push_subscriptions' && op.op === 'select' && op.count) return { count: 0 }
      return { error: null }
    }
    const res = await POST(req('POST', { subscriptionId: 'shared-sub' }))
    expect(res.status).toBe(200)

    // prior owner's association removed (delete scoped by neq user_id)
    const reassign = find(
      (o) => o.table === 'push_subscriptions' && o.op === 'delete' && o.neqs.some(([c]) => c === 'user_id')
    )
    expect(reassign).toBeTruthy()
    expect(reassign?.eqs).toContainEqual(['onesignal_player_id', 'shared-sub'])

    // prior owner, now deviceless, downgraded
    const downgrade = calls.find(
      (o) => o.table === 'users' && o.op === 'update' && o.eqs.some(([, v]) => v === 'user-2')
    )
    expect(downgrade?.payload).toEqual({ push_enabled: false })
  })
})

describe('DELETE /api/push/subscribe (P3.5-4C unregister)', () => {
  it('unauthorized DELETE fails with 401', async () => {
    currentUser = null
    const res = await DELETE(req('DELETE', { subscriptionId: 'sub-1' }))
    expect(res.status).toBe(401)
  })

  it('removes only the current device (scoped by user_id AND onesignal_player_id, never neq)', async () => {
    resolver = (op) => {
      if (op.op === 'select' && op.count) return { count: 1 } // another device remains
      return { error: null }
    }
    const res = await DELETE(req('DELETE', { subscriptionId: 'sub-A' }))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ subscribed: true, remaining: 1 })

    const del = find((o) => o.table === 'push_subscriptions' && o.op === 'delete')
    expect(del?.eqs).toContainEqual(['user_id', 'user-1'])
    expect(del?.eqs).toContainEqual(['onesignal_player_id', 'sub-A'])
    expect(del?.neqs).toHaveLength(0) // never a cross-user delete

    // a device remains → kill switch stays on
    const upd = find((o) => o.table === 'users' && o.op === 'update')
    expect(upd?.payload).toEqual({ push_enabled: true })
  })

  it('disables the kill switch when the last device is removed', async () => {
    resolver = (op) => {
      if (op.op === 'select' && op.count) return { count: 0 }
      return { error: null }
    }
    const res = await DELETE(req('DELETE', { subscriptionId: 'sub-last' }))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ subscribed: false, remaining: 0 })
    const upd = find((o) => o.table === 'users' && o.op === 'update')
    expect(upd?.payload).toEqual({ push_enabled: false })
  })

  it('a failed delete returns 500 and never re-derives the kill switch', async () => {
    resolver = (op) => {
      if (op.table === 'push_subscriptions' && op.op === 'delete') return { error: { message: 'db down' } }
      return { error: null }
    }
    const res = await DELETE(req('DELETE', { subscriptionId: 'sub-A' }))
    expect(res.status).toBe(500)
    const upd = find((o) => o.table === 'users' && o.op === 'update')
    expect(upd).toBeUndefined()
  })
})
