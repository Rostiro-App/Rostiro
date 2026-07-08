// T-85: the 3 paid tiers, with a "Choose plan" button per card that POSTs
// to /api/stripe/checkout and redirects to the returned Stripe URL. Server
// component for the initial plan/founding-count read (no client waterfall);
// the buttons themselves are a small client child component.

import { createSSRClient, createAdminClient } from '@/lib/supabase'
import { getFoundingCount } from '@/lib/founderRecognition'
import { redirect } from 'next/navigation'
import UpgradeButtons from './UpgradeButtons'

const FOUNDING_500_CAP = 500

export default async function UpgradePage({
  searchParams,
}: {
  searchParams: Promise<{ checkout?: string }>
}) {
  const supabase = await createSSRClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()
  const [{ data: row }, foundingCount] = await Promise.all([
    admin.from('users').select('plan').eq('id', user.id).maybeSingle(),
    getFoundingCount(admin),
  ])

  const plan = row?.plan ?? 'free'
  const { checkout } = await searchParams
  const foundingRemaining = Math.max(0, FOUNDING_500_CAP - foundingCount)

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-4">
      <h1 className="text-lg font-semibold text-white">Upgrade</h1>

      {checkout === 'success' && (
        <div className="rounded-xl p-3 text-sm" style={{ backgroundColor: 'rgba(52,199,89,0.1)', border: '1px solid rgba(52,199,89,0.35)', color: '#34C759' }}>
          Payment successful — your plan is now active.
        </div>
      )}
      {checkout === 'cancelled' && (
        <div className="rounded-xl p-3 text-sm" style={{ backgroundColor: 'var(--glass-solid)', border: '1px solid var(--hairline)', color: 'var(--t2)' }}>
          Checkout cancelled — no charge was made.
        </div>
      )}

      <UpgradeButtons currentPlan={plan} foundingRemaining={foundingRemaining} />
    </div>
  )
}
