import type { ReactNode } from 'react'
import { DemoStateProvider } from './lib/DemoStateProvider'

export default function DemoLayout({ children }: { children: ReactNode }) {
  return <DemoStateProvider autoplay>{children}</DemoStateProvider>
}
