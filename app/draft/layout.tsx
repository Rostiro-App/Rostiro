// T-64: Draft Kit is the free acquisition funnel — must render with no account.
// Logged-in users get the full app shell (sidebar/bottom nav); anonymous
// visitors get a lightweight header that funnels toward signup.

import { createSSRClient } from '@/lib/supabase'
import { isAdminUserId } from '@/lib/adminAuth'
import AppShell from '@/components/nav/AppShell'
import PublicHeader from '@/components/marketing/PublicHeader'

export default async function DraftLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createSSRClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (user) {
    // P3.5-4B: same server-resolved admin capability as the dashboard layout —
    // only the boolean crosses to the client, never the user id / ADMIN_USER_ID.
    return <AppShell enableSimulation={isAdminUserId(user.id)}>{children}</AppShell>
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--void)' }}>
      <PublicHeader />
      {children}
    </div>
  )
}
