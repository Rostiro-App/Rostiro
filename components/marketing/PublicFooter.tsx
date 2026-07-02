import Link from 'next/link'

export default function PublicFooter() {
  return (
    <footer
      className="px-4 md:px-6 py-10"
      style={{ backgroundColor: '#0A1520', borderTop: '1px solid #1A3048' }}
    >
      <div className="max-w-5xl mx-auto flex flex-col md:flex-row md:items-center md:justify-between gap-6">
        <div>
          <span className="text-white font-bold tracking-[0.15em] text-sm block mb-1">ROSTIRO</span>
          <p className="text-sm" style={{ color: '#3A5A7A' }}>Run Every League.</p>
        </div>
        <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm" style={{ color: '#5A7A9A' }}>
          <Link href="/draft" className="hover:text-white transition-colors">Draft Kit</Link>
          <Link href="/login" className="hover:text-white transition-colors">Sign in</Link>
          <Link href="/signup" className="hover:text-white transition-colors">Get started</Link>
        </div>
      </div>
      <p className="max-w-5xl mx-auto mt-8 text-xs" style={{ color: '#2A4560' }}>
        &copy; {new Date().getFullYear()} Rostiro. Not affiliated with ESPN, Yahoo, or Sleeper.
      </p>
    </footer>
  )
}
