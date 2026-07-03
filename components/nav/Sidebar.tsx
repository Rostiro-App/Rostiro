'use client'

// OS redesign: the 240px sidebar becomes a 52px icon dock — navigation is
// ambient chrome, not a page element. Labels live in hover tooltips
// (mono, glass) with the ⌘-number shortcuts the palette also handles.

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const NAV_ITEMS = [
  {
    href: '/pulse',
    label: 'Pulse',
    shortcut: '⌘1',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
      </svg>
    ),
  },
  {
    href: '/leagues',
    label: 'Leagues',
    shortcut: '⌘2',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7" rx="1.5" />
        <rect x="14" y="3" width="7" height="7" rx="1.5" />
        <rect x="3" y="14" width="7" height="7" rx="1.5" />
        <rect x="14" y="14" width="7" height="7" rx="1.5" />
      </svg>
    ),
  },
  {
    href: '/draft',
    label: 'Draft Kit',
    shortcut: '⌘3',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="9" y1="13" x2="15" y2="13" />
        <line x1="9" y1="17" x2="13" y2="17" />
      </svg>
    ),
  },
  {
    href: '/lineup',
    label: 'Lineups',
    shortcut: '⌘4',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 00-3-3.87" />
        <path d="M16 3.13a4 4 0 010 7.75" />
      </svg>
    ),
  },
  {
    href: '/trades',
    label: 'Trades',
    shortcut: '⌘5',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="17 1 21 5 17 9" />
        <path d="M3 11V9a4 4 0 014-4h14" />
        <polyline points="7 23 3 19 7 15" />
        <path d="M21 13v2a4 4 0 01-4 4H3" />
      </svg>
    ),
  },
]

const SETTINGS_ITEM = {
  href: '/settings',
  label: 'Settings',
  icon: (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
    </svg>
  ),
}

function DockTip({ children }: { children: React.ReactNode }) {
  return (
    <span
      className="glass-heavy mono-data hidden group-hover:block absolute left-[46px] top-1/2 -translate-y-1/2 whitespace-nowrap px-2.5 py-1.5 rounded-lg z-50 text-[11px]"
      style={{ color: 'var(--t1)' }}
    >
      {children}
    </span>
  )
}

function dockItemStyle(isActive: boolean): React.CSSProperties {
  return isActive
    ? {
        color: 'var(--signal)',
        backgroundColor: 'var(--signal-dim)',
        boxShadow: '0 0 18px rgba(75,163,245,.22), inset 0 0 0 1px rgba(75,163,245,.3)',
      }
    : { color: 'var(--t3)' }
}

export default function Sidebar() {
  const pathname = usePathname()

  return (
    <aside
      className="w-[52px] flex flex-col items-center h-full flex-shrink-0 py-3.5 gap-1.5 relative z-10"
      style={{
        borderRight: '1px solid var(--hairline)',
        background: 'rgba(8, 15, 26, 0.5)',
        backdropFilter: 'blur(14px)',
        WebkitBackdropFilter: 'blur(14px)',
      }}
    >
      {NAV_ITEMS.map((item) => {
        const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
        return (
          <span key={item.href} className="relative group">
            {isActive && (
              <span
                className="absolute -left-2 top-1/2 -translate-y-1/2 w-[2.5px] h-4 rounded-full"
                style={{ backgroundColor: 'var(--signal)', boxShadow: '0 0 8px var(--signal)' }}
              />
            )}
            <Link
              href={item.href}
              aria-label={item.label}
              className="flex items-center justify-center w-9 h-9 rounded-[10px] transition-all hover:bg-[rgba(75,163,245,0.07)]"
              style={dockItemStyle(isActive)}
            >
              {item.icon}
            </Link>
            <DockTip>
              {item.label} · <span style={{ color: 'var(--t3)' }}>{item.shortcut}</span>
            </DockTip>
          </span>
        )
      })}

      <span className="flex-1" />

      <span className="relative group">
        <Link
          href={SETTINGS_ITEM.href}
          aria-label="Settings"
          className="flex items-center justify-center w-9 h-9 rounded-[10px] transition-all hover:bg-[rgba(75,163,245,0.07)]"
          style={dockItemStyle(pathname.startsWith('/settings'))}
        >
          {SETTINGS_ITEM.icon}
        </Link>
        <DockTip>Settings</DockTip>
      </span>

      <span className="relative group">
        <form action="/api/auth/signout" method="POST">
          <button
            type="submit"
            aria-label="Sign out"
            className="flex items-center justify-center w-9 h-9 rounded-[10px] transition-all hover:bg-[rgba(232,80,74,0.08)]"
            style={{ color: 'var(--t3)' }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
          </button>
        </form>
        <DockTip>Sign out</DockTip>
      </span>
    </aside>
  )
}
