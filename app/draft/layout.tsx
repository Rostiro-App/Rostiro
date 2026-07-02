// T-64: Draft Kit is the free acquisition funnel — must render with no account.
// Logged-in users get the full app shell (sidebar/bottom nav); anonymous
// visitors get a lightweight header that funnels toward signup.

import { createSSRClient } from '@/lib/supabase'
import AppShell from '@/components/nav/AppShell'
import PublicHeader from '@/components/marketing/PublicHeader'

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
