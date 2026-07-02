// Shared header for public (no-auth) surfaces: marketing landing + Draft Kit.

import Link from 'next/link'

export default function PublicHeader() {
  return (
    <header
      className="flex items-center justify-between px-4 md:px-6 py-4 sticky top-0 z-10"
      style={{ backgroundColor: '#0A1520', borderBottom: '1px solid #1A3048' }}
    >
      <Link href="/" className="text-white font-bold tracking-[0.15em] text-sm">
        ROSTIRO
      </Link>
      <div className="flex items-center gap-2 md:gap-3">
        <Link
          href="/draft"
          className="hidden sm:block text-sm font-medium px-3 py-1.5 rounded-lg transition-all"
          style={{ color: '#8AAABB' }}
        >
          Draft Kit
        </Link>
        <Link
          href="/login"
          className="text-sm font-medium px-3 py-1.5 rounded-lg transition-all"
          style={{ color: '#8AAABB' }}
        >
          Sign in
        </Link>
        <Link
          href="/signup"
          className="text-sm font-semibold px-4 py-1.5 rounded-lg text-white transition-all hover:brightness-110"
          style={{ backgroundColor: '#378ADD' }}
        >
          Get started free
        </Link>
      </div>
    </header>
  )
}
