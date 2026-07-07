'use client'

// T-145: admin viewer for app_error_log (T-138) — gated to the founder
// account the same way Profile's Founding 500 panel is (plan ===
// 'commissioner'). The real gate is server-side in /api/admin/errors
// (that route re-checks plan itself via the admin client, since
// app_error_log's RLS only grants service_role); this client-side check
// is just so a non-founder sees a clean "not available" message instead
// of a page that fetches and fails.

import { useEffect, useState } from 'react'

interface ErrorLogRow {
  id: string
  source: string
  message: string
  stack: string | null
  context: Record<string, unknown> | null
  created_at: string
}

export default function AdminErrorsPage() {
  const [plan, setPlan] = useState<string | null>(null)
  const [errors, setErrors] = useState<ErrorLogRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch('/api/settings')
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((d: { plan: string }) => {
        if (cancelled) return
        setPlan(d.plan)
        if (d.plan !== 'commissioner') {
          setLoading(false)
          return
        }
        return fetch('/api/admin/errors')
          .then((res) => (res.ok ? res.json() : Promise.reject()))
          .then((data: { errors: ErrorLogRow[] }) => {
            if (!cancelled) setErrors(data.errors ?? [])
          })
      })
      .catch(() => {
        if (!cancelled) setError('Could not load the error log.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  if (loading) {
    return <div className="max-w-3xl mx-auto px-4 pt-6 pb-8 md:px-6 md:pt-8" />
  }

  if (plan !== 'commissioner') {
    return (
      <div className="max-w-3xl mx-auto px-4 pt-6 pb-8 md:px-6 md:pt-8">
        <p className="text-sm" style={{ color: 'var(--t3)' }}>This page isn&apos;t available.</p>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto px-4 pt-6 pb-8 md:px-6 md:pt-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white tracking-tight">Error log</h1>
        <p className="text-sm mt-0.5" style={{ color: 'var(--t2)' }}>
          Most recent {errors.length} {errors.length === 1 ? 'entry' : 'entries'} from <code>app_error_log</code>, newest first.
        </p>
        <p className="text-xs mt-2" style={{ color: 'var(--t4)' }}>
          Uptime monitoring: point Better Stack at <code>/api/system/health</code> to get paged when the app goes down —
          that&apos;s a Better Stack dashboard step, not something configured here.
        </p>
      </div>

      {error && (
        <div className="rounded-xl p-4 mb-4" style={{ backgroundColor: 'rgba(8, 15, 26, 0.6)', border: '1px solid var(--hairline)' }}>
          <p className="text-sm" style={{ color: 'var(--crit)' }}>{error}</p>
        </div>
      )}

      {errors.length === 0 && !error ? (
        <p className="text-sm" style={{ color: 'var(--t3)' }}>Nothing logged yet.</p>
      ) : (
        <div className="space-y-2">
          {errors.map((e) => (
            <div key={e.id} className="rounded-xl p-4" style={{ backgroundColor: 'rgba(8, 15, 26, 0.6)', border: '1px solid var(--hairline)' }}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <span
                    className="text-[10px] font-semibold tracking-widest uppercase px-1.5 py-0.5 rounded"
                    style={{ backgroundColor: 'rgba(226,75,74,0.12)', color: '#E8504A' }}
                  >
                    {e.source}
                  </span>
                  <p className="text-sm mt-1.5" style={{ color: 'var(--t1)' }}>{e.message}</p>
                </div>
                <span className="text-xs flex-shrink-0" style={{ color: 'var(--t4)' }}>
                  {new Date(e.created_at).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                </span>
              </div>

              {(e.stack || e.context) && (
                <button
                  type="button"
                  onClick={() => setExpandedId((id) => (id === e.id ? null : e.id))}
                  className="text-xs font-semibold mt-2 hover:brightness-125"
                  style={{ color: 'var(--signal)' }}
                >
                  {expandedId === e.id ? 'Hide details' : 'Show details'}
                </button>
              )}

              {expandedId === e.id && (
                <pre
                  className="text-[11px] mt-2 p-2.5 rounded-lg overflow-x-auto whitespace-pre-wrap break-words"
                  style={{ backgroundColor: 'rgba(6, 11, 19, 0.6)', color: 'var(--t3)' }}
                >
                  {[e.stack, e.context ? JSON.stringify(e.context, null, 2) : null].filter(Boolean).join('\n\n')}
                </pre>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
