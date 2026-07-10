'use client'
import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { useDemo } from './lib/DemoStateProvider'
import { StandardState } from './components/StandardState'
import { DirectorConsole } from './components/DirectorConsole'
import { ScriptedToast } from './components/ScriptedToast'

export function DemoTour({ consoleVisible }: { consoleVisible: boolean }) {
  const { state } = useDemo()
  return (
    <>
      {state.currentState === 'standard'
        ? <StandardState />
        : <div style={{ padding: 48, textAlign: 'center', opacity: 0.7 }}>
            {state.currentState} — engine ships in a follow-on spec
          </div>}
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
