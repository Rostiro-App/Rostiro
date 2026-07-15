// New component, 2026-07-15: shared social-follow row for the footer and
// the About page. Inline SVGs, matching this codebase's existing icon
// convention (no lucide-react/heroicons/etc. dependency anywhere else --
// see PulseMark.tsx, nav/Sidebar.tsx). Only links accounts with a real,
// confirmed handle -- TikTok isn't listed here because it wasn't live/
// connected as of this pass; add it once there's a real handle to point
// to, don't guess one.

const LINKS = [
  { label: 'X', href: 'https://x.com/RostiroOS', icon: 'x' as const },
  { label: 'Instagram', href: 'https://instagram.com/rostrioapp', icon: 'instagram' as const },
  { label: 'YouTube', href: 'https://youtube.com/@rostirosports', icon: 'youtube' as const },
]

function Icon({ kind }: { kind: 'x' | 'instagram' | 'youtube' }) {
  const common = { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'currentColor', 'aria-hidden': true as const }
  if (kind === 'x') {
    return (
      <svg {...common}>
        <path d="M18.9 2H22l-7.6 8.7L23.3 22h-6.9l-5.4-7.1L4.8 22H1.7l8.2-9.3L1 2h7.1l4.9 6.5L18.9 2Zm-1.2 18h1.9L7.4 4h-2l12.3 16Z" />
      </svg>
    )
  }
  if (kind === 'instagram') {
    return (
      <svg {...common}>
        <rect x="3" y="3" width="18" height="18" rx="5" fill="none" stroke="currentColor" strokeWidth="1.8" />
        <circle cx="12" cy="12" r="4.2" fill="none" stroke="currentColor" strokeWidth="1.8" />
        <circle cx="17.2" cy="6.8" r="1.1" />
      </svg>
    )
  }
  return (
    <svg {...common}>
      <rect x="2.5" y="5.5" width="19" height="13" rx="3.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M10 9.2v5.6l5-2.8-5-2.8Z" />
    </svg>
  )
}

export default function SocialLinks() {
  return (
    <div className="flex items-center gap-4">
      {LINKS.map((l) => (
        <a
          key={l.label}
          href={l.href}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Rostiro on ${l.label}`}
          className="transition-opacity hover:opacity-70"
          style={{ color: 'var(--t2)' }}
        >
          <Icon kind={l.icon} />
        </a>
      ))}
    </div>
  )
}
