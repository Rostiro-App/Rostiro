'use client'

// T-111 follow-up (founder request, July 5 2026): user-facing toggle for
// the big Game Day animations (full-screen takeovers, unlock reveal) —
// forecast in Settings now rather than retrofitted later. localStorage,
// not the users table: this is a per-device presentation preference
// (someone may want takeovers on their TV-side tablet but not their
// work laptop), same tier as the existing "keep screen on" toggle.
// Default ON — the animations are the product's Game Day identity;
// opting out is the deliberate act.

const KEY = 'rostiro_big_animations'

export function bigAnimationsEnabled(): boolean {
  if (typeof window === 'undefined') return true
  return localStorage.getItem(KEY) !== 'false'
}

export function setBigAnimationsEnabled(enabled: boolean): void {
  localStorage.setItem(KEY, String(enabled))
}
