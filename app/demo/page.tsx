'use client'
import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { useDemo } from './lib/DemoStateProvider'
import { DemoShell } from './components/DemoShell'
import { StandardState } from './components/StandardState'
import { DirectorConsole } from './components/DirectorConsole'
import { ScriptedToast } from './components/ScriptedToast'

export function DemoTour({ consoleVisible }: { consoleVisible: boolean }) {
  const { state } = useDemo()
  return (
    <>
      <DemoShell>
        {state.currentState === 'standard'
          ? <StandardState />
          : <div className="mono-data flex items-center justify-center h-full text-center" style={{ padding: 48, color: 'var(--t3)', letterSpacing: '0.06em' }}>
              {state.currentState.toUpperCase().replace('_', ' ')} — ENGINE SHIPS IN A FOLLOW-ON SPEC
            </div>}
      </DemoShell>
      <ScriptedToast />
      <DirectorConsole visible={consoleVisible} />
    </>
  )
}

// Console gating (verbatim from spec): dev, or ?studio=true. In Next 16
// searchParams is a server Promise, so read it on the client via the hook
// (wrapped in Suspense per Next's CSR-bailout requirement).
function DemoTourWithParams() {
  const sp = useSearchParams()
  const consoleVisible = process.env.NODE_ENV === 'development' || sp.get('studio') === 'true'
  return <DemoTour consoleVisible={consoleVisible} />
}

export default function Page() {
  return (
    <Suspense fallback={null}>
      <DemoTourWithParams />
    </Suspense>
  )
}
