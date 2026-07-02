'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import SleeperConnect from '@/components/onboarding/SleeperConnect'
import YahooConnect from '@/components/onboarding/YahooConnect'
import EspnConnect from '@/components/onboarding/EspnConnect'

type Step = 'choose' | 'sleeper' | 'yahoo' | 'espn'

export default function OnboardingPage() {
  const [step, setStep] = useState<Step>('choose')
  const [connected, setConnected] = useState<string[]>([])
  const router = useRouter()

  function onConnected(platform: string) {
    setConnected((prev) => [...new Set([...prev, platform])])
    setStep('choose')
  }

  return (
    <div className="min-h-screen bg-black px-4 py-12">
      <div className="max-w-lg mx-auto">
        <div className="mb-10 text-center">
          <h1 className="text-2xl font-bold text-white tracking-tight">ROSTIRO</h1>
          <p className="text-zinc-400 mt-2">Connect your leagues to get started.</p>
          <p className="text-zinc-600 text-sm mt-1">Connect at least one. You can add more anytime.</p>
        </div>

        {step === 'choose' && (
          <div className="space-y-3">
            <PlatformCard
              name="Sleeper"
              description="No login needed — just your username."
              connected={connected.includes('sleeper')}
              onClick={() => setStep('sleeper')}
            />
            <PlatformCard
              name="Yahoo"
              description="Connect with Yahoo OAuth. Full read + write."
              connected={connected.includes('yahoo')}
              onClick={() => setStep('yahoo')}
            />
            <PlatformCard
              name="ESPN"
              description="Requires cookies from your browser. Read only."
              connected={connected.includes('espn')}
              onClick={() => setStep('espn')}
            />

            {connected.length > 0 && (
              <button
                onClick={() => router.push('/dashboard')}
                className="mt-6 w-full bg-white text-black font-semibold py-3 rounded-xl text-sm hover:bg-zinc-100 transition-colors"
              >
                Go to dashboard →
              </button>
            )}
          </div>
        )}

        {step === 'sleeper' && (
          <SleeperConnect onBack={() => setStep('choose')} onConnected={() => onConnected('sleeper')} />
        )}
        {step === 'yahoo' && (
          <YahooConnect onBack={() => setStep('choose')} onConnected={() => onConnected('yahoo')} />
        )}
        {step === 'espn' && (
          <EspnConnect onBack={() => setStep('choose')} onConnected={() => onConnected('espn')} />
        )}
      </div>
    </div>
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
      className="w-full bg-zinc-900 border border-zinc-800 hover:border-zinc-600 rounded-xl p-4 text-left transition-colors flex items-center justify-between group"
    >
      <div>
        <div className="flex items-center gap-2">
          <span className="text-white font-medium">{name}</span>
          {connected && (
            <span className="text-xs bg-green-900/50 text-green-400 border border-green-800 px-2 py-0.5 rounded-full">
              Connected
            </span>
          )}
        </div>
        <p className="text-zinc-500 text-sm mt-0.5">{description}</p>
      </div>
      <span className="text-zinc-600 group-hover:text-zinc-400 transition-colors text-lg">→</span>
    </button>
  )
}
