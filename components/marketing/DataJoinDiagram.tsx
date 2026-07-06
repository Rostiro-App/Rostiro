// Real SVG, not a screenshot — the actual join chain lib/nflverseUsage.ts
// resolves once per sync (T-87): nflverse's snap_counts release only carries
// a Pro-Football-Reference id, not a Sleeper one, so getting usage data onto
// a Sleeper roster takes three real hops. Static and content-only (no
// external asset, no animation) — this is meant to be glanceable for the
// Savant reader in under five seconds, not a marketing centerpiece.

const NODES = [
  { label: 'nflverse', sub: 'snap_counts release', key: 'pfr_player_id' },
  { label: 'players.csv', sub: 'nflverse crosswalk', key: 'gsis_id' },
  { label: 'Sleeper', sub: '/players/nfl payload', key: 'sleeper_id' },
]

export default function DataJoinDiagram() {
  const width = 720
  const height = 160
  const boxWidth = 180
  const boxHeight = 84
  const gap = (width - NODES.length * boxWidth) / (NODES.length - 1)

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="w-full h-auto"
      role="img"
      aria-label="Data join chain: nflverse snap counts join to Sleeper player IDs via a PFR-to-GSIS crosswalk"
    >
      {NODES.map((node, i) => {
        const x = i * (boxWidth + gap)
        const y = (height - boxHeight) / 2
        return (
          <g key={node.label}>
            <rect
              x={x}
              y={y}
              width={boxWidth}
              height={boxHeight}
              rx={12}
              fill="var(--glass-solid)"
              stroke={i === NODES.length - 1 ? 'var(--signal)' : 'var(--hairline-bright)'}
              strokeWidth={1.5}
            />
            <text
              x={x + boxWidth / 2}
              y={y + 30}
              textAnchor="middle"
              fill="var(--t1)"
              fontSize={15}
              fontWeight={700}
            >
              {node.label}
            </text>
            <text
              x={x + boxWidth / 2}
              y={y + 48}
              textAnchor="middle"
              fill="var(--t3)"
              fontSize={11}
            >
              {node.sub}
            </text>
            <text
              x={x + boxWidth / 2}
              y={y + 68}
              textAnchor="middle"
              fill="var(--signal)"
              fontSize={11}
              fontFamily="var(--font-mono, monospace)"
            >
              {node.key}
            </text>
            {i < NODES.length - 1 && (
              <>
                <line
                  x1={x + boxWidth}
                  y1={height / 2}
                  x2={x + boxWidth + gap - 10}
                  y2={height / 2}
                  stroke="var(--hairline-bright)"
                  strokeWidth={1.5}
                />
                <polygon
                  points={`${x + boxWidth + gap - 10},${height / 2 - 5} ${x + boxWidth + gap},${height / 2} ${x + boxWidth + gap - 10},${height / 2 + 5}`}
                  fill="var(--hairline-bright)"
                />
              </>
            )}
          </g>
        )
      })}
    </svg>
  )
}
