export interface WinProbInput {
  marginNow: number          // my projected-live points minus opponent's, right now
  secondsRemaining: number   // game-seconds left across my active players (0..3600+)
  projMargin: number         // expected final margin given remaining projections
}

/**
 * Logistic model. As time runs out the live margin dominates; early on the
 * projected final margin dominates. Sigma shrinks with remaining time so a
 * lead is worth more late. Demo-scoped but pure and side-effect-free, so it
 * can graduate into lib/ for the real Live tab later.
 */
export function winProb({ marginNow, secondsRemaining, projMargin }: WinProbInput): number {
  const frac = Math.max(0, Math.min(1, secondsRemaining / 3600)) // 1 = full game left
  // Blend: late game trusts the current margin, early game trusts projection.
  const effectiveMargin = marginNow * (1 - frac) + projMargin * frac
  // Uncertainty (points) scales with remaining time; floor keeps end-game crisp.
  const sigma = 3 + 22 * frac
  const p = 1 / (1 + Math.exp(-effectiveMargin / sigma))
  return Math.max(0, Math.min(1, p))
}
