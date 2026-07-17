'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import ModeSelection from '@/components/onboarding/ModeSelection'
import SleeperConnect from '@/components/onboarding/SleeperConnect'
import YahooConnect from '@/components/onboarding/YahooConnect'
import EspnConnect from '@/components/onboarding/EspnConnect'

type Step = 'mode' | 'connect' | 'sleeper' | 'yahoo' | 'espn'

const CONNECT_ERRORS: Record<string, string> = {
  yahoo_auth_failed: 'Yahoo connection failed. Please try again.',
  espn_auth_failed: 'ESPN connection failed. Check your cookies and try again.',
}

function OnboardingFlow() {
  const searchParams = useSearchParams()
  const errorParam = searchParams.get('error')
  // Set by the Yahoo OAuth callback on success (app/api/auth/yahoo/
  // callback/route.ts) — a stored token isn't a completed connection yet,
  // so this lands the user back on the 'yahoo' step to visibly import
  // before anything is marked connected, never at 'mode' (a full-page
  // redirect remounts this component fresh, and 'mode' was the previous,
  // wrong default for this case).
  const yahooImporting = searchParams.get('yahoo') === 'importing'
  const router = useRouter()

  // A failed OAuth/cookie connect redirects back here as a full page
  // navigation (not a client route change), which remounts this component
  // and would otherwise silently drop the user back to step 1 with no
  // indication anything failed. Land on 'connect' with the error surfaced
  // instead of resetting the whole flow.
  const [step, setStep] = useState<Step>(errorParam ? 'connect' : yahooImporting ? 'yahoo' : 'mode')
  const [connected, setConnected] = useState<string[]>([])
  const [connectError, setConnectError] = useState<string | null>(
    errorParam ? (CONNECT_ERRORS[errorParam] ?? 'That connection failed. Please try again.') : null
  )

  useEffect(() => {
    if (errorParam || yahooImporting) router.replace('/onboarding')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function onConnected(platform: string) {
    setConnectError(null)
    setConnected((prev) => [...new Set([...prev, platform])])
    setStep('connect')
  }

  if (step === 'mode') {
    return <ModeSelection onContinue={() => setStep('connect')} />
  }

  return (
    <div className="min-h-screen px-4 py-12" style={{ backgroundColor: 'var(--void)' }}>
      <div className="max-w-lg mx-auto">
        <div className="mb-10 text-center">
          <p className="text-xs font-semibold tracking-[0.2em] uppercase mb-6" style={{ color: 'var(--signal)' }}>
            ROSTIRO · Step 2 of 6
          </p>
          <h1 className="text-2xl font-bold text-white tracking-tight">Connect your leagues</h1>
          <p className="text-sm mt-2" style={{ color: 'var(--t2)' }}>
            Connect at least one. Rostiro can&apos;t help until you do.
          </p>
        </div>

        {connectError && (
          <div
            className="mb-4 rounded-lg px-4 py-3 text-sm"
            style={{ backgroundColor: 'rgba(226,75,74,0.12)', border: '1px solid rgba(226,75,74,0.35)', color: '#E24B4A' }}
          >
            {connectError}
          </div>
        )}

        {step === 'connect' && (
          <div className="space-y-3">
            <PlatformCard
              name="Sleeper"
              description="No login needed, just your username."
              connected={connected.includes('sleeper')}
              onClick={() => setStep('sleeper')}
            />
            <PlatformCard
              name="Yahoo"
              description="Connect with Yahoo OAuth. Read-only."
              connected={connected.includes('yahoo')}
              onClick={() => setStep('yahoo')}
            />
            <PlatformCard
              name="Unlock ESPN"
              description="Browser cookies. Read-only. Takes 2 minutes."
              connected={connected.includes('espn')}
              onClick={() => setStep('espn')}
            />

            {connected.length > 0 && (
              <button
                onClick={() => router.push('/pulse')}
                className="mt-6 w-full font-semibold py-3 rounded-xl text-sm text-white transition-all hover:brightness-110"
                style={{ backgroundColor: 'var(--signal)' }}
              >
                Continue →
              </button>
            )}

            {connected.length === 0 && (
              <p className="text-center text-xs pt-4" style={{ color: 'var(--t3)' }}>
                Skip is available, but your Pulse will be empty.
              </p>
            )}
          </div>
        )}

        {step === 'sleeper' && (
          <SleeperConnect onBack={() => setStep('connect')} onConnected={() => onConnected('sleeper')} />
        )}
        {step === 'yahoo' && (
          <YahooConnect
            onBack={() => setStep('connect')}
            onConnected={() => onConnected('yahoo')}
            startImporting={yahooImporting}
          />
        )}
        {step === 'espn' && (
          <EspnConnect onBack={() => setStep('connect')} onConnected={() => onConnected('espn')} />
        )}
      </div>
    </div>
  )
}

export default function OnboardingPage() {
  return (
    <Suspense fallback={null}>
      <OnboardingFlow />
    </Suspense>
  )
}

function PlatformCard({
  name,
  description,
  connected,
  onClick,
}: {
  name: string
  description: string
  connected: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="w-full rounded-xl p-4 text-left transition-all flex items-center justify-between group"
      style={{
        backgroundColor: 'rgba(8, 15, 26, 0.6)',
        border: `1.5px solid ${connected ? 'rgba(75,163,245,.35)' : 'var(--hairline)'}`,
      }}
    >
      <div>
        <div className="flex items-center gap-2">
          <span className="text-white font-medium">{name}</span>
          {connected && (
            <span
              className="text-xs px-2 py-0.5 rounded-full font-medium"
              style={{ backgroundColor: '#1A3D1A', color: 'var(--live)', border: '1px solid #2A5A2A' }}
            >
              Connected
            </span>
          )}
        </div>
        <p className="text-sm mt-0.5" style={{ color: 'var(--t2)' }}>{description}</p>
      </div>
      <span className="text-lg transition-colors" style={{ color: 'var(--t3)' }}>→</span>
    </button>
  )
}
