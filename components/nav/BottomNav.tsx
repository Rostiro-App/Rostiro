'use client'

// T-68: bottom nav now matches the PRD 7 spec exactly — Pulse / Leagues /
// Draft / More, four thumb-reachable targets instead of six cramped ones.
// Lineups, Trades, Settings, and sign out (previously unreachable on
// mobile at all) live in the More sheet.

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import { useLiveUnlocked } from '@/lib/useLiveUnlocked'
import { useLiveUnlockTransition } from '@/lib/useLiveUnlockTransition'

const NAV_ITEMS = [
  {
    href: '/pulse',
    label: 'Pulse',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
      </svg>
    ),
  },
  {
    href: '/leagues',
    label: 'Leagues',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
      </svg>
    ),
  },
  {
    href: '/draft',
    label: 'Draft',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="9" y1="13" x2="15" y2="13" />
        <line x1="9" y1="17" x2="13" y2="17" />
      </svg>
    ),
  },
]

const MORE_ITEMS = [
  { href: '/lineup', label: 'Lineups' },
  { href: '/trades', label: 'Trades' },
  { href: '/settings', label: 'Settings' },
]

export default function BottomNav() {
  const pathname = usePathname()
  const [moreOpen, setMoreOpen] = useState(false)
  const liveUnlocked = useLiveUnlocked()
  const liveUnlocking = useLiveUnlockTransition(liveUnlocked)
  const liveActive = pathname === '/live' || pathname.startsWith('/live/')

  const moreActive = MORE_ITEMS.some(
    (item) => pathname === item.href || pathname.startsWith(item.href + '/')
  )

  return (
    <>
      <nav
        className="fixed bottom-0 left-0 right-0 flex items-stretch z-40"
        style={{
          backgroundColor: 'rgba(8, 15, 26, 0.6)',
          borderTop: '1px solid var(--hairline)',
          height: '60px',
          // Safe area for iPhone home indicator
          paddingBottom: 'env(safe-area-inset-bottom)',
        }}
      >
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex-1 flex flex-col items-center justify-center gap-0.5 transition-all"
              style={{ color: isActive ? 'var(--signal)' : 'var(--t3)' }}
            >
              {item.icon}
              <span className="text-[10px] font-medium leading-none">{item.label}</span>
            </Link>
          )
        })}
        {/* T-111: dimmed/untappable outside Game Day State, same rule as
            the desktop Sidebar's icon — reuses rostiroState, no new
            detection. */}
        {liveUnlocked ? (
          <Link
            href="/live"
            className={`flex-1 flex flex-col items-center justify-center gap-0.5 transition-all ${liveUnlocking ? 'live-unlock-flash' : ''}`.trim()}
            style={{ color: '#E24B4A' }}
          >
            <svg
              width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
              style={liveActive || liveUnlocking ? undefined : { animation: 'rostiro-breathe 2.4s ease-in-out infinite' }}
            >
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
            </svg>
            <span className="text-[10px] font-medium leading-none" style={{ color: liveActive ? '#E24B4A' : 'var(--t3)' }}>LIVE</span>
          </Link>
        ) : (
          <span className="flex-1 flex flex-col items-center justify-center gap-0.5" style={{ color: 'var(--t4)', opacity: 0.4 }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
            </svg>
            <span className="text-[10px] font-medium leading-none">LIVE</span>
          </span>
        )}
        <button
          type="button"
          onClick={() => setMoreOpen(true)}
          className="flex-1 flex flex-col items-center justify-center gap-0.5 transition-all"
          style={{ color: moreActive ? 'var(--signal)' : 'var(--t3)', background: 'none', border: 'none' }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <circle cx="5" cy="12" r="1.5" fill="currentColor" />
            <circle cx="12" cy="12" r="1.5" fill="currentColor" />
            <circle cx="19" cy="12" r="1.5" fill="currentColor" />
          </svg>
          <span className="text-[10px] font-medium leading-none">More</span>
        </button>
      </nav>

      {moreOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end"
          style={{ backgroundColor: '#00000080' }}
          onClick={() => setMoreOpen(false)}
        >
          <div
            className="w-full rounded-t-2xl p-4 pb-8"
            style={{ backgroundColor: 'var(--glass-solid)', border: '1px solid var(--hairline)', borderBottom: 'none' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="w-9 h-1 rounded-full mx-auto mb-4"
              style={{ backgroundColor: 'var(--hairline)' }}
            />
            <div className="space-y-1">
              {MORE_ITEMS.map((item) => {
                const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMoreOpen(false)}
                    className="block px-4 py-3 rounded-xl text-sm font-medium"
                    style={{
                      color: isActive ? 'var(--signal)' : 'white',
                      backgroundColor: isActive ? 'var(--signal-dim)' : 'transparent',
                    }}
                  >
                    {item.label}
                  </Link>
                )
              })}
            </div>
            <div style={{ height: '1px', backgroundColor: 'var(--hairline)', margin: '10px 4px' }} />
            <form action="/api/auth/signout" method="POST">
              <button
                type="submit"
                className="w-full text-left px-4 py-3 rounded-xl text-sm"
                style={{ color: 'var(--t3)', background: 'none', border: 'none' }}
              >
                Sign out
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
