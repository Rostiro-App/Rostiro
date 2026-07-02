// T-64: Draft Kit is the free acquisition funnel — must render with no account.
// Logged-in users get the full app shell (sidebar/bottom nav); anonymous
// visitors get a lightweight header that funnels toward signup.

import Link from 'next/link'
import { createSSRClient } from '@/lib/supabase'
import AppShell from '@/components/nav/AppShell'

export default async function DraftLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createSSRClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (user) {
    return <AppShell>{children}</AppShell>
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#0D1B2A' }}>
      <PublicHeader />
      {children}
    </div>
  )
}

function PublicHeader() {
  return (
    <header
      className="flex items-center justify-between px-4 md:px-6 py-4"
      style={{ backgroundColor: '#0A1520', borderBottom: '1px solid #1A3048' }}
    >
      <Link href="/" className="text-white font-bold tracking-[0.15em] text-sm">
        ROSTIRO
      </Link>
      <div className="flex items-center gap-3">
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
