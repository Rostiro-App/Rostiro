// T-112: rebuilt on the real Rostiro OS tokens, matching PublicHeader.

import Link from 'next/link'
import SocialLinks from './SocialLinks'

export default function PublicFooter() {
  return (
    <footer
      className="px-4 md:px-6 py-10"
      style={{ backgroundColor: 'var(--glass-solid)', borderTop: '1px solid var(--hairline)' }}
    >
      <div className="max-w-5xl mx-auto flex flex-col md:flex-row md:items-center md:justify-between gap-6">
        <div>
          <span className="mono-data font-bold tracking-[0.15em] text-sm block mb-1" style={{ color: 'var(--t1)' }}>
            ROSTIRO
          </span>
          <p className="text-sm" style={{ color: 'var(--t3)' }}>Run Every League.</p>
        </div>
        <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm" style={{ color: 'var(--t2)' }}>
          <Link href="/features" className="transition-colors hover:opacity-80">Features</Link>
          <Link href="/draft" className="transition-colors hover:opacity-80">Draft Kit</Link>
          <Link href="/about" className="transition-colors hover:opacity-80">About</Link>
          <Link href="/faq" className="transition-colors hover:opacity-80">FAQ</Link>
          <Link href="/login" className="transition-colors hover:opacity-80">Sign in</Link>
          <Link href="/signup" className="transition-colors hover:opacity-80">Get started</Link>
          <Link href="/privacy" className="transition-colors hover:opacity-80">Privacy</Link>
          <Link href="/terms" className="transition-colors hover:opacity-80">Terms</Link>
        </div>
        <SocialLinks />
      </div>
      <p className="max-w-5xl mx-auto mt-8 text-xs" style={{ color: 'var(--t4)' }}>
        &copy; {new Date().getFullYear()} Rostiro. Not affiliated with ESPN, Yahoo, or Sleeper.
      </p>
    </footer>
  )
}
