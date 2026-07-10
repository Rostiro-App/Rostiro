import { describe, it, expect } from 'vitest'
import { SURFACE_PACKS } from './studioPacks'

describe('SURFACE_PACKS', () => {
  it('registers the standard pack with the required shape', () => {
    const p = SURFACE_PACKS.standard
    expect(p).toBeTruthy()
    expect(typeof p!.prefill).toBe('function')
    expect(p!.AuthorForm).toBeTruthy()
    expect(p!.FullSurface).toBeTruthy()
    expect(p!.FocalCard).toBeTruthy()
  })
})
