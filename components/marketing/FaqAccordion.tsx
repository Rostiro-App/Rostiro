'use client'

// Plain, dependency-free accordion. No external library, matches every
// other interactive surface in this codebase (ModeSwitcher, Command
// Palette) in being hand-rolled against the real design tokens. Multiple
// items can stay open at once; nothing here needs the "only one open"
// constraint the Interrupt Stack has, since these aren't competing for
// attention the way live alerts are.

import { useState } from 'react'

export interface FaqItem {
  question: string
  answer: React.ReactNode
  // Plain-text version of `answer`, used only for FAQPage JSON-LD (Task 6
  // of docs/superpowers/plans/2026-07-08-seo-llm-crawlability.md) — schema.org
  // requires plain text, but `answer` is JSX (sometimes with inline links).
  // Keep this in sync manually when editing an answer; FAQ content changes
  // rarely.
  answerText: string
}

export default function FaqAccordion({ items }: { items: FaqItem[] }) {
  const [openIds, setOpenIds] = useState<Set<number>>(new Set([0]))

  function toggle(i: number) {
    setOpenIds((prev) => {
      const next = new Set(prev)
      if (next.has(i)) next.delete(i)
      else next.add(i)
      return next
    })
  }

  return (
    <div className="space-y-2.5">
      {items.map((item, i) => {
        const isOpen = openIds.has(i)
        return (
          <div key={item.question} className="glass rounded-xl overflow-hidden">
            <button
              type="button"
              onClick={() => toggle(i)}
              aria-expanded={isOpen}
              className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left"
            >
              <span className="text-sm md:text-base font-semibold" style={{ color: 'var(--t1)' }}>
                {item.question}
              </span>
              <span
                className="mono-data text-lg flex-shrink-0 transition-transform"
                style={{ color: 'var(--signal)', transform: isOpen ? 'rotate(45deg)' : 'none' }}
                aria-hidden="true"
              >
                +
              </span>
            </button>
            {isOpen && (
              <div className="px-5 pb-5 text-sm leading-relaxed" style={{ color: 'var(--t2)' }}>
                {item.answer}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
