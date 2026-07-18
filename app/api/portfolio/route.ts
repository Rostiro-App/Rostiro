// Packet 03, P3-6B: the first real production consumer of
// lib/crossPlatformPortfolio*.ts. Live computation (not the historical
// weekly snapshot table) so a caller always gets the current, real
// cross-platform exposure/health for their own account — no ownership
// check beyond authentication is needed since this always computes for
// the caller's own userId, never an arbitrary one from the request.
//
// No UI currently calls this route — see the P3-6B completion report.
// This exists so a future Portfolio page/consumer has a real, tested
// endpoint to call rather than needing to build one from scratch.

import { createSSRClient } from '@/lib/supabase'
import { computeUserCrossPlatformPortfolio } from '@/lib/crossPlatformPortfolioSync'
import { NextResponse } from 'next/server'

export async function GET() {
  const supabase = await createSSRClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const portfolio = await computeUserCrossPlatformPortfolio(user.id)

  return NextResponse.json({
    exposure: portfolio.exposure,
    health: portfolio.health.map((h) => ({
      connectedLeagueId: h.connectedLeagueId,
      leagueName: h.leagueName,
      platform: h.platform,
      health: h.result.health,
      factorCoverage: h.result.factorCoverage,
      adpSource: h.result.adpSource,
    })),
    // Lets a caller distinguish included_fresh / included_stale /
    // unavailable / unsupported / approval_pending / failed leagues, per
    // P3-6B's coverage-metadata requirement.
    coverage: portfolio.coverage,
  })
}
