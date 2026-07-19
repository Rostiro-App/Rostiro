import { redirect } from 'next/navigation'
import { createSSRClient } from '@/lib/supabase'
import { isAdminUserId } from '@/lib/adminAuth'
import AppShell from '@/components/nav/AppShell'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createSSRClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  // P3.5-4B: resolve the admin capability server-side from the authenticated
  // user id and pass only the boolean to the client shell — never the user id
  // or ADMIN_USER_ID. A non-admin's shell won't mount SimulationPanel, so it
  // never probes /api/admin/simulate. The route stays independently protected.
  const enableSimulation = isAdminUserId(user.id)

  return <AppShell enableSimulation={enableSimulation}>{children}</AppShell>
}
