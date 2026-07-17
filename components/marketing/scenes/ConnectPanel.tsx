import type { ReactNode } from 'react'

const PLATFORMS = [
  { key: 'sleeper', name: 'Sleeper', description: 'No login needed, just your username.' },
  { key: 'yahoo', name: 'Yahoo', description: 'Connect with Yahoo OAuth. Read-only.' },
  { key: 'espn', name: 'Unlock ESPN', description: 'Browser cookies. Read-only. Takes 2 minutes.' },
] as const

export type ConnectedMap = { sleeper: boolean; yahoo: boolean; espn: boolean }

function PlatformCard({ name, description, connected }: { name: string; description: string; connected: boolean }): ReactNode {
  return (
    <div
      className="w-full rounded-xl p-4 text-left flex items-center justify-between"
      style={{ backgroundColor: 'rgba(8, 15, 26, 0.6)', border: `1.5px solid ${connected ? 'rgba(75,163,245,.35)' : 'var(--hairline)'}` }}
    >
      <div>
        <div className="flex items-center gap-2">
          <span className="text-white font-medium">{name}</span>
          {connected && (
            <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: '#1A3D1A', color: 'var(--live)', border: '1px solid #2A5A2A' }}>
              Connected
            </span>
          )}
        </div>
        <p className="text-sm mt-0.5" style={{ color: 'var(--t2)' }}>{description}</p>
      </div>
      <span className="text-lg" style={{ color: 'var(--t3)' }}>→</span>
    </div>
  )
}

export function ConnectPanel({ connected }: { connected: ConnectedMap }) {
  const anyConnected = connected.sleeper || connected.yahoo || connected.espn
  return (
    <div className="absolute inset-0 overflow-hidden px-4 py-6 md:py-8" style={{ backgroundColor: 'var(--void)' }}>
      <div className="ambient-ground" aria-hidden="true" />
      <div className="max-w-lg mx-auto relative z-10">
        <div className="mb-6 text-center">
          <p className="text-xs font-semibold tracking-[0.2em] uppercase mb-4" style={{ color: 'var(--signal)' }}>ROSTIRO · Step 2 of 6</p>
          <h1 className="text-2xl font-bold text-white tracking-tight">Connect your leagues</h1>
          <p className="text-sm mt-2" style={{ color: 'var(--t2)' }}>Connect at least one. Rostiro can&apos;t help until you do.</p>
        </div>
        <div className="space-y-3">
          {PLATFORMS.map((p) => (
            <PlatformCard key={p.key} name={p.name} description={p.description} connected={connected[p.key]} />
          ))}
          {anyConnected && (
            <div className="mt-6 w-full font-semibold py-3 rounded-xl text-sm text-white text-center" style={{ backgroundColor: 'var(--signal)' }}>
              Continue →
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
