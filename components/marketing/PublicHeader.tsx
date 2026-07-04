// Shared header for public (no-auth) surfaces: marketing landing + Draft Kit.
// T-112: rebuilt on the real Rostiro OS tokens (glass-bar, var(--t1) etc.)
// instead of hardcoded navy hex — this is the same chrome material the
// System Bar uses post-auth, not an approximation of it.

import Link from 'next/link'

export default function PublicHeader() {
  return (
    <header
      className="glass-bar flex items-center justify-between px-4 md:px-6 py-4 sticky top-0 z-10"
      style={{ borderBottom: '1px solid var(--hairline)' }}
    >
      <Link href="/" className="mono-data font-bold tracking-[0.15em] text-sm" style={{ color: 'var(--t1)' }}>
        ROSTIRO
      </Link>
      <div className="flex items-center gap-2 md:gap-3">
        <Link
          href="/draft"
          className="hidden sm:block text-sm font-medium px-3 py-1.5 rounded-lg transition-colors hover:opacity-80"
          style={{ color: 'var(--t2)' }}
        >
          Draft Kit
        </Link>
        <Link
          href="/login"
          className="text-sm font-medium px-3 py-1.5 rounded-lg transition-colors hover:opacity-80"
          style={{ color: 'var(--t2)' }}
        >
          Sign in
        </Link>
        <Link
          href="/signup"
          className="text-sm font-semibold px-4 py-1.5 rounded-lg text-white transition-all hover:brightness-110"
          style={{ backgroundColor: 'var(--cta)' }}
        >
          Get started free
        </Link>
      </div>
    </header>
  )
}
