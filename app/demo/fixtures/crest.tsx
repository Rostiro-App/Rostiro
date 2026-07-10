export function DemoCrest({ size = 64 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" role="img" aria-label="Lawrence's Legends crest">
      <circle cx="32" cy="32" r="31" fill="#0b1c3a" stroke="#c8ccd4" strokeWidth="1.5" />
      <text x="32" y="30" textAnchor="middle" fontSize="26" fontWeight="800" fill="#1f3a63" opacity="0.4" fontFamily="serif">LL</text>
      {/* Rostiro pulse mark */}
      <path d="M12 34 h10 l4 -12 l6 22 l4 -10 h16" fill="none" stroke="#3b82f6" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  )
}
