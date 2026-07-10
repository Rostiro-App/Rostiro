import { describe, it, expect } from 'vitest'
import { rowToPulseItem, type PulseItemRow } from './pulse'

const baseRow: PulseItemRow = {
  id: '1', user_id: 'u', type: 'touchdown_swing', priority: 'info',
  headline: 'h', reasoning: 'r', affected_leagues_json: [],
  deadline: null, action_url: null, platform: 'sleeper', status: 'open', created_at: 't',
} as PulseItemRow

describe('rowToPulseItem metrics', () => {
  it('maps metrics_json onto metrics', () => {
    const item = rowToPulseItem({ ...baseRow, metrics_json: [{ leagueName: 'L', label: 'Win Prob', value: '62%', deltaPositive: true }] })
    expect(item.metrics).toHaveLength(1)
    expect(item.metrics![0].value).toBe('62%')
  })
  it('maps null/absent metrics_json to undefined', () => {
    expect(rowToPulseItem({ ...baseRow, metrics_json: null }).metrics).toBeUndefined()
    expect(rowToPulseItem(baseRow).metrics).toBeUndefined()
  })
})
