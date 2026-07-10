'use client'
import { useDemo } from '../lib/DemoStateProvider'

export function ScriptedToast() {
  const { state } = useDemo()
  if (!state.activeAlert) return null
  const a = state.activeAlert
  return (
    <div role="status" style={{ position: 'fixed', top: 16, right: 16, zIndex: 9000,
      background: '#111827', color: '#fff', padding: '12px 16px', borderRadius: 10,
      borderLeft: '4px solid #3b82f6', maxWidth: 320 }}>
      <div style={{ fontWeight: 700, fontSize: 13 }}>{a.title}</div>
      <div style={{ fontSize: 13, opacity: 0.85 }}>{a.body}</div>
    </div>
  )
}
