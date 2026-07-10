'use client'
import { useMemo } from 'react'
import { SceneStage } from './SceneStage'
import { DemoShell } from '@/app/demo/components/DemoShell'
import { StandardState } from '@/app/demo/components/StandardState'
import { DemoInterruptCard } from './DemoInterruptCard'
import { loadFixtures } from '@/app/demo/lib/loadFixtures'

const DURATION = 360 // 12s @ 30fps
const ENTER = 90
const DISMISS = 320 // ~7s after enter (210f) + entry settle

export function InterruptScene({ frame }: { frame?: number } = {}) {
  const { players, week } = useMemo(() => loadFixtures(), [])
  const top = useMemo(() => {
    const scores = Object.values(week.boxScores).sort((a, b) => b.points - a.points)
    const box = scores[0]
    const p = players.find((x) => x.id === box?.playerId)
    return { name: p?.name ?? 'Your player', points: box?.points ?? 0, line: box?.line ?? '' }
  }, [players, week])

  return (
    <SceneStage durationFrames={DURATION} caption="Only the important thing interrupts, then clears itself — interactive demo." staticFrame={150} frame={frame}>
      {(f) => {
        const showCard = f >= ENTER && f < DISMISS + 10
        const leaving = f >= DISMISS
        return (
          <DemoShell variant="contained" stateOverride="game_day">
            <StandardState missionControl />
            {showCard && (
              <DemoInterruptCard
                leaving={leaving}
                headline={`${top.name} — TOUCHDOWN`}
                reasoning={`${top.name} just posted ${top.points} pts (${top.line}). Your live win probability just jumped.`}
              />
            )}
          </DemoShell>
        )
      }}
    </SceneStage>
  )
}
