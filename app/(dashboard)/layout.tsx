import { redirect } from 'next/navigation'
import { createSSRClient } from '@/lib/supabase'
import AppShell from '@/components/nav/AppShell'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createSSRClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  return <AppShell>{children}</AppShell>
}
