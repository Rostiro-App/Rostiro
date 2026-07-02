'use client'

export default function YahooConnect({
  onBack,
  onConnected: _onConnected, // called after OAuth redirect completes
}: {
  onBack: () => void
  onConnected: () => void
}) {
  function handleConnect() {
    window.location.href = '/api/auth/yahoo'
  }

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
      <button onClick={onBack} className="text-zinc-500 hover:text-zinc-300 text-sm mb-5 flex items-center gap-1">
        ← Back
      </button>
      <h2 className="text-white font-semibold mb-1">Connect Yahoo</h2>
      <p className="text-zinc-500 text-sm mb-5">
        You&apos;ll be redirected to Yahoo to authorize Rostiro. This allows Rostiro to read your leagues
        and submit lineup changes on your behalf.
      </p>

      <div className="bg-zinc-800 rounded-lg p-4 mb-5">
        <p className="text-zinc-400 text-xs font-medium uppercase tracking-wide mb-2">What Rostiro can do</p>
        <ul className="space-y-1.5">
          {[
            'Read your leagues, rosters, and matchups',
            'Submit lineup changes directly',
            'Add/drop players on waivers',
            'Propose trades',
          ].map((item) => (
            <li key={item} className="text-zinc-300 text-sm flex items-start gap-2">
              <span className="text-green-400 mt-0.5">✓</span>
              {item}
            </li>
          ))}
        </ul>
        <p className="text-zinc-500 text-xs mt-3">
          Attribution: Fantasy data provided by Yahoo Fantasy.
        </p>
      </div>

      <button
        onClick={handleConnect}
        className="w-full bg-[#6001D2] hover:bg-[#5001b0] text-white font-semibold py-2.5 rounded-lg text-sm transition-colors"
      >
        Connect with Yahoo →
      </button>
    </div>
  )
}
