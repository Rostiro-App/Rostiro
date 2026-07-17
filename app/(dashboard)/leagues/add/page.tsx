'use client'

// T-109 (league integration gap, found 2026-07-04): a returning user had no
// way to connect an additional league — /onboarding was the only path, and
// it drags a returning user through mode selection again with no clean way
// back to the app. This reuses the same three connector components
// onboarding already uses, in a standalone flow that belongs to the
// authenticated app (AppShell chrome, not a full-page takeover) and
// actually returns to /leagues when done.

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import SleeperConnect from '@/components/onboarding/SleeperConnect'
import YahooConnect from '@/components/onboarding/YahooConnect'
import EspnConnect from '@/components/onboarding/EspnConnect'

type Step = 'pick' | 'sleeper' | 'yahoo' | 'espn'

export default function AddLeaguePage() {
  const router = useRouter()
  const [step, setStep] = useState<Step>('pick')

  function handleConnected() {
    router.push('/leagues')
  }

  return (
    <div className="max-w-lg mx-auto px-4 pt-6 pb-8 md:px-6 md:pt-8">
      <div className="mb-6">
        <h1 className="text-[22px] font-semibold tracking-tight" style={{ color: 'var(--t1)' }}>Add a league</h1>
        <p className="text-[13px] mt-0.5" style={{ color: 'var(--t2)' }}>
          Rostiro checks every connected league on every sync.
        </p>
      </div>

      {step === 'pick' && (
        <div className="space-y-3">
          <PlatformCard
            name="Sleeper"
            description="No login needed — just your username."
            onClick={() => setStep('sleeper')}
          />
          <PlatformCard
            name="Yahoo"
            description="Connect with Yahoo OAuth. Read-only."
            onClick={() => setStep('yahoo')}
          />
          <PlatformCard
            name="ESPN"
            description="Browser cookies. Read-only. Takes 2 minutes."
            onClick={() => setStep('espn')}
          />
        </div>
      )}

      {step === 'sleeper' && (
        <SleeperConnect onBack={() => setStep('pick')} onConnected={handleConnected} />
      )}
      {step === 'yahoo' && (
        <YahooConnect onBack={() => setStep('pick')} onConnected={handleConnected} />
      )}
      {step === 'espn' && (
        <EspnConnect onBack={() => setStep('pick')} onConnected={handleConnected} />
      )}
    </div>
  )
}

function PlatformCard({
  name,
  description,
  onClick,
}: {
  name: string
  description: string
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="glass card-hover w-full rounded-xl p-4 text-left transition-all flex items-center justify-between"
    >
      <div>
        <span className="text-sm font-medium" style={{ color: 'var(--t1)' }}>{name}</span>
        <p className="text-sm mt-0.5" style={{ color: 'var(--t2)' }}>{description}</p>
      </div>
      <span className="text-lg" style={{ color: 'var(--t3)' }}>→</span>
    </button>
  )
}
