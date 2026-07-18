import { describe, it, expect } from 'vitest'
import { GET as aliasGET } from './route'
import { GET as canonicalGET } from '../route'

describe('GET /api/pulse/sleeper — P3-8B: temporary compatibility alias', () => {
  it('re-exports the exact same handler as the platform-neutral /api/pulse route', () => {
    expect(aliasGET).toBe(canonicalGET)
  })
})
