/**
 * Phase-0 demo data pipeline. Run manually:
 *   npx tsx scripts/demo/build-fixtures.mts
 *
 * Sources (all real, public):
 *   - nflverse player weekly stats (GitHub release CSV) — identity + fantasy points
 *   - Fantasy Football Calculator ADP API (half-PPR, 10-team)
 *
 * SEASON NOTE: anchored on the 2024 season. nflverse's `player_stats` release
 * only publishes complete seasons; 2025 weekly stats are not yet available
 * upstream (verified via the GitHub releases API), so 2024 is the most recent
 * fully-real season. Every player/stat number below comes from real 2024 data;
 * nothing is hand-typed or randomized. Swap SEASON to 2025 once nflverse ships
 * `player_stats_2025.csv` and re-run.
 *
 * Selects the highest-drama fantasy-regular-season Sunday (weeks 1–14) as the
 * anchor week and bakes players.json / week.json / waivers.json.
 */
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const SEASON = 2024
const OUT = fileURLToPath(new URL('../../app/demo/fixtures', import.meta.url))

const NFLVERSE = 'https://github.com/nflverse/nflverse-data/releases/download'
const WEEKLY_URL = `${NFLVERSE}/player_stats/player_stats_${SEASON}.csv`
const ADP_URL = `https://fantasyfootballcalculator.com/api/v1/adp/half-ppr?teams=10&year=${SEASON}`

// --- Quote-aware CSV parser -------------------------------------------------
// nflverse CSVs quote fields that contain commas (e.g. headshot URLs contain
// "f_auto,q_auto"), so a naive split(',') corrupts every row. RFC-4180 rules:
// double-quoted fields, embedded quotes doubled.
function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = []
  let field = ''
  let record: string[] = []
  let inQuotes = false
  const s = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  for (let i = 0; i < s.length; i++) {
    const c = s[i]
    if (inQuotes) {
      if (c === '"') {
        if (s[i + 1] === '"') { field += '"'; i++ } else { inQuotes = false }
      } else field += c
    } else if (c === '"') inQuotes = true
    else if (c === ',') { record.push(field); field = '' }
    else if (c === '\n') { record.push(field); rows.push(record); record = []; field = '' }
    else field += c
  }
  if (field.length > 0 || record.length > 0) { record.push(field); rows.push(record) }
  const [head, ...body] = rows
  return body
    .filter((r) => r.length > 1)
    .map((cells) => Object.fromEntries(head.map((h, i) => [h, cells[i] ?? ''])) as Record<string, string>)
}

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`${url} → ${res.status}`)
  return res.text()
}

const num = (v: string | undefined): number => {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}
const norm = (name: string): string =>
  name.toLowerCase().replace(/[.'`-]/g, '').replace(/\s+(jr|sr|ii|iii|iv|v)$/i, '').replace(/\s+/g, ' ').trim()

/** Half-PPR = mean of standard and full-PPR (full-PPR adds 1.0/rec, half adds 0.5/rec). */
const halfPpr = (row: Record<string, string>): number =>
  (num(row.fantasy_points) + num(row.fantasy_points_ppr)) / 2

/** Human-readable stat line from a weekly row (position-aware, only non-zero parts). */
function statLine(row: Record<string, string>): string {
  const parts: string[] = []
  const pass = num(row.passing_yards), pTd = num(row.passing_tds), ints = num(row.interceptions)
  const carr = num(row.carries), rush = num(row.rushing_yards), rTd = num(row.rushing_tds)
  const rec = num(row.receptions), recY = num(row.receiving_yards), recTd = num(row.receiving_tds)
  if (pass || pTd) parts.push(`${pass} pass yds${pTd ? `, ${pTd} TD` : ''}${ints ? `, ${ints} INT` : ''}`)
  if (carr || rush) parts.push(`${carr} car, ${rush} rush yds${rTd ? `, ${rTd} TD` : ''}`)
  if (rec || recY) parts.push(`${rec} rec, ${recY} yds${recTd ? `, ${recTd} TD` : ''}`)
  return parts.join(' · ') || '—'
}

// --- Load -------------------------------------------------------------------
console.log(`Fetching ${SEASON} weekly stats + ADP …`)
const weekly = parseCsv(await fetchText(WEEKLY_URL)).filter((r) => r.season_type === 'REG')
const adpJson = JSON.parse(await fetchText(ADP_URL)) as {
  players: { name: string; position: string; team: string; adp: number }[]
}
const adpByName = new Map(adpJson.players.map((p) => [norm(p.name), p.adp]))
console.log(`Rows: ${weekly.length} REG player-weeks · ADP entries: ${adpJson.players.length}`)

// --- Anchor-week selection (fantasy regular season, weeks 1–14) --------------
const byWeek = new Map<number, { total: number; booms: number }>()
for (const row of weekly) {
  const wk = num(row.week)
  if (wk < 1 || wk > 14) continue
  const pts = halfPpr(row)
  const cur = byWeek.get(wk) ?? { total: 0, booms: 0 }
  cur.total += Math.max(0, pts)
  if (pts >= 25) cur.booms += 1
  byWeek.set(wk, cur)
}
const anchorWeek = [...byWeek.entries()]
  .sort((a, b) => (b[1].total + b[1].booms * 10) - (a[1].total + a[1].booms * 10))[0][0]
console.log('Selected anchor week:', anchorWeek, byWeek.get(anchorWeek))

// --- Aggregate season totals per player -------------------------------------
interface Agg { id: string; name: string; pos: string; team: string; headshot: string; points: number; games: number; lastWeek: number }
const agg = new Map<string, Agg>()
for (const row of weekly) {
  const id = row.player_id
  if (!id) continue
  const wk = num(row.week)
  const a = agg.get(id) ?? { id, name: row.player_display_name, pos: row.position, team: row.recent_team, headshot: row.headshot_url, points: 0, games: 0, lastWeek: 0 }
  a.points += halfPpr(row)
  a.games += 1
  if (wk >= a.lastWeek) { a.lastWeek = wk; a.name = row.player_display_name; a.pos = row.position; a.team = row.recent_team; a.headshot = row.headshot_url }
  agg.set(id, a)
}

// --- players.json (top 220 by season half-PPR points) -----------------------
const ranked = [...agg.values()].sort((a, b) => b.points - a.points).slice(0, 220)
const players = ranked.map((a) => ({
  id: a.id,
  name: a.name,
  pos: a.pos,
  nflTeam: a.team,
  headshotUrl: a.headshot || null,
  adp: adpByName.get(norm(a.name)) ?? null,
  season: { points: Math.round(a.points * 10) / 10, games: a.games },
}))
const withAdp = players.filter((p) => p.adp != null).length
console.log(`players.json: ${players.length} players · ${withAdp} matched to ADP`)

// --- week.json (anchor-week box scores) -------------------------------------
const keep = new Set(players.map((p) => p.id))
const boxScores: Record<string, { playerId: string; points: number; line: string }> = {}
for (const row of weekly) {
  if (num(row.week) !== anchorWeek) continue
  if (!keep.has(row.player_id)) continue
  boxScores[row.player_id] = {
    playerId: row.player_id,
    points: Math.round(halfPpr(row) * 10) / 10,
    line: statLine(row),
  }
}
const week = { week: anchorWeek, matchups: [], boxScores }
console.log(`week.json: week ${anchorWeek}, ${Object.keys(boxScores).length} box scores`)

// --- waivers.json (real anchor-week breakouts) ------------------------------
// A breakout = a big anchor-week performance from a player who was undrafted or
// drafted late (high/absent ADP), relative to that player's own prior average.
// addPct and faabSuggestion are transparently DERIVED from the real boom size —
// nflverse has no roster-add data — and scale with how far above baseline the
// player played. No stat numbers are invented.
const priorAvg = new Map<string, number>()
const priorGames = new Map<string, number>()
for (const row of weekly) {
  const wk = num(row.week)
  if (wk >= anchorWeek) continue
  priorAvg.set(row.player_id, (priorAvg.get(row.player_id) ?? 0) + halfPpr(row))
  priorGames.set(row.player_id, (priorGames.get(row.player_id) ?? 0) + 1)
}
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n))
const waivers = players
  .map((p) => {
    const box = boxScores[p.id]
    if (!box) return null
    const g = priorGames.get(p.id) ?? 0
    const avg = g ? (priorAvg.get(p.id) ?? 0) / g : 0
    const boom = box.points - avg
    const lowRostered = p.adp == null || p.adp > 100 // undrafted or very late
    if (!lowRostered || box.points < 15 || boom < 8) return null
    return {
      playerId: p.id,
      name: p.name,
      pos: p.pos,
      addPct: clamp(Math.round(boom * 3), 5, 95),
      faabSuggestion: clamp(Math.round(boom * 1.5), 2, 40),
    }
  })
  .filter((w): w is NonNullable<typeof w> => w !== null)
  .sort((a, b) => b.addPct - a.addPct)
  .slice(0, 12)
console.log(`waivers.json: ${waivers.length} breakout candidates`)

// --- Write ------------------------------------------------------------------
writeFileSync(path.join(OUT, 'players.json'), JSON.stringify(players, null, 2) + '\n')
writeFileSync(path.join(OUT, 'week.json'), JSON.stringify(week, null, 2) + '\n')
writeFileSync(path.join(OUT, 'waivers.json'), JSON.stringify(waivers, null, 2) + '\n')
console.log(`Wrote players.json / week.json / waivers.json to ${OUT} (anchor week ${anchorWeek}, season ${SEASON}).`)
