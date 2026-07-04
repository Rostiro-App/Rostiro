'use client'

// T-75: shared focus trap for full-screen modal overlays (Pulse's detail
// drawer, Command Palette) — previously neither moved focus into itself on
// open, trapped Tab within its own bounds, or restored focus on close, so a
// keyboard/screen-reader user tabbing through the page could reach content
// behind the (visually blocking) overlay. InterruptStack is deliberately
// excluded — it's a non-blocking toast, not a modal, so trapping focus
// there would be wrong.

import { useEffect, useRef } from 'react'

const FOCUSABLE = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'

export function useFocusTrap(active: boolean, containerRef: React.RefObject<HTMLElement | null>) {
  const previouslyFocused = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (!active) return
    const container = containerRef.current
    if (!container) return

    previouslyFocused.current = document.activeElement as HTMLElement | null

    const focusables = container.querySelectorAll<HTMLElement>(FOCUSABLE)
    ;(focusables[0] ?? container).focus()

    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== 'Tab' || !container) return
      const nodes = Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE))
      if (nodes.length === 0) return
      const first = nodes[0]
      const last = nodes[nodes.length - 1]

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      previouslyFocused.current?.focus()
    }
  }, [active, containerRef])
}
