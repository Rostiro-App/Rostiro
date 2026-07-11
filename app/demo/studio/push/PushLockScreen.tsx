'use client'
import type { PushMoment } from '@/app/demo/lib/pushMoment'

// Full-bleed 9:16 iOS lock-screen. The captured clip IS the phone screen
// (no device bezel). Deterministic, props-only. In 16:9, the phone is
// centered on a neutral backdrop so the aspect toggle never breaks.
export function PushLockScreen({ content, aspect }: { content: PushMoment; aspect: '16:9' | '9:16' }) {
  const phone = (
    <div
      className="relative overflow-hidden"
      style={{
        width: '100%', height: '100%', maxWidth: aspect === '16:9' ? 320 : undefined,
        aspectRatio: '9 / 16', margin: '0 auto', borderRadius: 28,
        background: 'radial-gradient(120% 90% at 50% 0%, #0a1626 0%, #03070d 70%)',
      }}
    >
      {/* status bar */}
      <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-6 pt-3 text-white" style={{ fontSize: 12, opacity: 0.9 }}>
        <span>{content.clockTime}</span>
        <span style={{ letterSpacing: 1 }}>▪▪▪ ▪ ▮</span>
      </div>

      {/* big clock + date */}
      <div className="absolute left-0 right-0 text-center text-white" style={{ top: '11%' }}>
        <div style={{ fontSize: 20, opacity: 0.85 }}>{content.dateLabel}</div>
        <div style={{ fontSize: 76, fontWeight: 300, lineHeight: 1.05 }}>{content.clockTime}</div>
      </div>

      {/* notification card */}
      <div className="absolute left-3 right-3" style={{ top: '40%' }}>
        <div
          className="glass-heavy"
          style={{ borderRadius: 18, padding: '12px 14px', border: '1px solid var(--hairline-bright)' }}
        >
          <div className="flex items-center gap-2" style={{ marginBottom: 6 }}>
            <div style={{ width: 22, height: 22, borderRadius: 6, background: 'var(--signal)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 12, fontWeight: 700 }}>R</div>
            <span className="mono-data" style={{ fontSize: 11, letterSpacing: 1, color: 'var(--t2)' }}>{content.appName.toUpperCase()}</span>
            <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--t3)' }}>{content.timeLabel}</span>
          </div>
          <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--t1)', marginBottom: 3 }}>{content.title}</div>
          <div style={{ fontSize: 13, color: 'var(--t2)', lineHeight: 1.35 }}>{content.body}</div>
        </div>
      </div>

      {/* bottom affordances */}
      <div className="absolute left-0 right-0 flex items-center justify-between px-8 text-white" style={{ bottom: '5%', opacity: 0.7 }}>
        <span style={{ fontSize: 18 }}>🔦</span>
        <span style={{ fontSize: 18 }}>📷</span>
      </div>
    </div>
  )

  return (
    <div className="relative w-full mx-auto" style={{ aspectRatio: aspect === '16:9' ? '16 / 9' : '9 / 16', maxWidth: aspect === '16:9' ? '100%' : 480 }}>
      <div className="absolute inset-0 flex items-center justify-center" style={{ background: aspect === '16:9' ? 'var(--void)' : 'transparent' }}>
        <div style={{ height: aspect === '16:9' ? '92%' : '100%' }}>{phone}</div>
      </div>
    </div>
  )
}
