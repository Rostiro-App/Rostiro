'use client'

export default function YahooConnect({
  onBack,
  onConnected: _onConnected,
}: {
  onBack: () => void
  onConnected: () => void
}) {
  function handleConnect() {
    window.location.href = '/api/auth/yahoo'
  }

  return (
    <div className="rounded-xl p-6" style={{ backgroundColor: 'rgba(8, 15, 26, 0.6)', border: '1.5px solid var(--hairline)' }}>
      <button
        onClick={onBack}
        className="text-sm mb-5 flex items-center gap-1"
        style={{ color: 'var(--t2)' }}
      >
        ← Back
      </button>
      <h2 className="text-white font-semibold mb-1">Connect Yahoo</h2>
      <p className="text-sm mb-5" style={{ color: 'var(--t2)' }}>
        You&apos;ll be redirected to Yahoo to authorize Rostiro with read-only access. Rostiro reads your
        leagues, rosters, and matchups to build recommendations — you make the actual move on Yahoo,
        one tap away.
      </p>

      <div className="rounded-lg p-4 mb-5" style={{ backgroundColor: 'rgba(6, 11, 19, 0.55)', border: '1px solid var(--hairline)' }}>
        <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: 'rgba(75,163,245,.35)' }}>
          What Rostiro can do
        </p>
        <ul className="space-y-1.5">
          {[
            'Read your leagues, rosters, and matchups',
            'Build lineup, waiver, and trade recommendations',
            'Link straight to Yahoo to make the move',
          ].map((item) => (
            <li key={item} className="text-sm flex items-start gap-2" style={{ color: 'var(--t2)' }}>
              <span className="mt-0.5" style={{ color: 'var(--live)' }}>✓</span>
              {item}
            </li>
          ))}
        </ul>
        <p className="text-xs mt-3" style={{ color: 'var(--t3)' }}>
          Fantasy data provided by Yahoo Fantasy.
        </p>
      </div>

      <button
        onClick={handleConnect}
        className="w-full font-semibold py-2.5 rounded-lg text-sm text-white transition-all hover:brightness-110"
        style={{ backgroundColor: '#6001D2' }}
      >
        Connect with Yahoo →
      </button>
    </div>
  )
}
