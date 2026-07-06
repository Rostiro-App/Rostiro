// Mirrors lib/brandTokens.ts and app/globals.css. Duplicated rather than
// imported across the Next.js "@/" alias because Remotion's own bundler
// doesn't share Next's webpack config, and hardcoding a handful of hex
// values is simpler and more reliable than wiring up a shared alias for a
// one-directory video project. If the real brand tokens change, update
// both places.

export const COLORS = {
  void: '#0D1B2A',
  navyDark: '#0A1520',
  navyCard: '#0F2235',
  hairline: '#1A3050',
  hairlineBright: '#2A4A70',
  textPrimary: '#D0E4F5',
  textMuted: '#4A6580',
  textDim: '#6B87A3',
  signal: '#4BA3F5',
  signalDim: 'rgba(75,163,245,0.14)',
  warn: '#F5A623',
  crit: '#E8504A',
  live: '#1D9E75',
} as const

export const STATE_COLOR = {
  draft: '#1D9E75',
  standard: '#378ADD',
  waiver_day: '#1D9E75',
  game_day: '#E24B4A',
  film_room: '#7F77DD',
} as const

export type RostiroStateKey = keyof typeof STATE_COLOR

export const FONT_FAMILY = 'Inter, system-ui, sans-serif'
