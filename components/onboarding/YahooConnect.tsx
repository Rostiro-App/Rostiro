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
    <div className="rounded-xl p-6" style={{ backgroundColor: '#0A1520', border: '1.5px solid #1A3048' }}>
      <button
        onClick={onBack}
        className="text-sm mb-5 flex items-center gap-1"
        style={{ color: '#5A7A9A' }}
      >
        ← Back
      </button>
      <h2 className="text-white font-semibold mb-1">Connect Yahoo</h2>
      <p className="text-sm mb-5" style={{ color: '#5A7A9A' }}>
        You&apos;ll be redirected to Yahoo to authorize Rostiro. This allows Rostiro to read your leagues
        and submit lineup changes on your behalf.
      </p>

      <div className="rounded-lg p-4 mb-5" style={{ backgroundColor: '#07111C', border: '1px solid #1A3048' }}>
        <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: '#378ADD55' }}>
          What Rostiro can do
        </p>
        <ul className="space-y-1.5">
          {[
            'Read your leagues, rosters, and matchups',
            'Submit lineup changes directly',
            'Add/drop players on waivers',
            'Propose trades',
          ].map((item) => (
            <li key={item} className="text-sm flex items-start gap-2" style={{ color: '#8AAABB' }}>
              <span className="mt-0.5" style={{ color: '#4CAF72' }}>✓</span>
              {item}
            </li>
          ))}
        </ul>
        <p className="text-xs mt-3" style={{ color: '#3A5A7A' }}>
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
