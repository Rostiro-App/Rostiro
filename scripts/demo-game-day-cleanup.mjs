// Removes everything scripts/demo-game-day-seed.mjs created. Safe to run
// any time — only ever touches demo_-prefixed game_ids, which real data
// never uses. Run this once you're done reviewing the Game Day demo; also
// remove DEMO_MODE / DEMO_ROSTER_TEAMS from .env.local if you're fully done
// (leave them if you plan to re-seed and look again later).

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'

const env = Object.fromEntries(
  readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    .split('\n')
    .filter((l) => l.includes('=') && !l.startsWith('#'))
    .map((l) => {
      const i = l.indexOf('=')
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()]
    })
)

const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)

const { error: scoreErr, count: scoreCount } = await admin
  .from('live_scores')
  .delete({ count: 'exact' })
  .like('game_id', 'demo_%')
if (scoreErr) throw new Error(`live_scores cleanup failed: ${scoreErr.message}`)

const { error: schedErr, count: schedCount } = await admin
  .from('nfl_schedule')
  .delete({ count: 'exact' })
  .like('game_id', 'demo_%')
if (schedErr) throw new Error(`nfl_schedule cleanup failed: ${schedErr.message}`)

console.log(`Removed ${scoreCount ?? 0} live_scores row(s) and ${schedCount ?? 0} nfl_schedule row(s).`)
