// Demo Game Day slate — local design-review tool, NOT part of the app's
// real data pipeline. Seeds two in-progress games into nfl_schedule +
// live_scores so Game Day State (T-79/T-81/T-90) can be seen running live
// against the real UI, without waiting for an actual NFL Sunday.
//
// Safety: every row uses a `demo_` prefixed game_id, which can never collide
// with a real nflverse id (those look like `2026_01_NE_SEA`) — the real
// nfl-schedule/live-scores crons upsert only real ids, so they will never
// touch, overwrite, or be confused by these rows. game_date is set to today
// (real wall-clock date), which is what makes computeState() see a live
// game right now. Run scripts/demo-game-day-cleanup.mjs when done — these
// rows are global (visible to every account against this Supabase project),
// not scoped to one user.
//
// Requires DEMO_MODE=true + DEMO_ROSTER_TEAMS in .env.local for the
// roster-relevant Pulse/System Bar surfaces to pick these up (this
// account's real league is ESPN, which isn't roster-wired yet).

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

const now = new Date()
const todayEt = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(now)
// ~2h45m ago, so both games read as mid-Q3 right now regardless of when
// this script is actually run.
const kickoffAt = new Date(now.getTime() - 2.75 * 60 * 60 * 1000).toISOString()

const games = [
  {
    schedule: {
      game_id: 'demo_2026_TEN_NYJ',
      season: 2026,
      game_type: 'REG',
      week: 1,
      game_date: todayEt,
      game_time_et: kickoffAt.slice(11, 19),
      home_team: 'TEN',
      away_team: 'NYJ',
    },
    score: {
      game_id: 'demo_2026_TEN_NYJ',
      home_score: 27, // Derrick Henry go-ahead/insurance TD framing
      away_score: 20,
      period: 3,
      display_clock: '6:12',
      status_state: 'in',
    },
  },
  {
    schedule: {
      game_id: 'demo_2026_DAL_PHI',
      season: 2026,
      game_type: 'REG',
      week: 7,
      game_date: todayEt,
      game_time_et: kickoffAt.slice(11, 19),
      home_team: 'PHI',
      away_team: 'DAL',
    },
    score: {
      game_id: 'demo_2026_DAL_PHI',
      home_score: 17, // Jalen Hurts red-zone INT, returned by Dallas for a TD
      away_score: 24,
      period: 3,
      display_clock: '9:47',
      status_state: 'in',
    },
  },
]

// nfl_schedule's kickoff_at is a generated column (game_date + game_time_et
// at America/New_York) — insert game_date/game_time_et in ET, not raw UTC,
// so the generated timestamp actually lands ~2h45m in the past.
const kickoffEt = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/New_York', hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit',
}).format(new Date(now.getTime() - 2.75 * 60 * 60 * 1000))

for (const g of games) g.schedule.game_time_et = kickoffEt

const { error: schedErr } = await admin.from('nfl_schedule').upsert(games.map((g) => g.schedule), { onConflict: 'game_id' })
if (schedErr) throw new Error(`nfl_schedule upsert failed: ${schedErr.message}`)

const { error: scoreErr } = await admin.from('live_scores').upsert(
  games.map((g) => ({ ...g.score, last_synced_at: new Date().toISOString() })),
  { onConflict: 'game_id' }
)
if (scoreErr) throw new Error(`live_scores upsert failed: ${scoreErr.message}`)

console.log(`Seeded ${games.length} demo games for ${todayEt}, kickoff ~${kickoffEt} ET:`)
for (const g of games) {
  console.log(`  ${g.schedule.away_team} ${g.score.away_score} @ ${g.schedule.home_team} ${g.score.home_score} — Q${g.score.period} ${g.score.display_clock}`)
}
console.log('\nRun scripts/demo-game-day-cleanup.mjs when done reviewing.')
