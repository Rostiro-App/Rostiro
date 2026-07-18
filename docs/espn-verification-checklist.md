# ESPN Intelligence Adapter — Deferred Verification Checklist

**Status:** partially verified. `lib/platforms/espn.ts` was built from real, live-captured ESPN Fantasy API responses (session of 2026-07-17, league 123456789 "Example ESPN League", a real user league) — but that league had not yet drafted at capture time, which blocks several items below from being verified against real data. This is the root cause behind every unchecked item; do not work around it with synthetic fixtures or by relaxing the implementation to make a check appear to pass.

**Do not edit the Packet 03 ESPN adapter to make any of these appear complete.** If a real run reveals the implementation is wrong, fix the implementation and re-run the check — don't adjust the check to match whatever the code currently does.

**When league 123456789 (or another connected ESPN league) actually drafts**, work through this list top to bottom.

---

## 1. Populated roster capture

- [ ] Re-capture `mRoster`/`mTeam` (`getEspnRosters`) for a team with a real, non-empty `roster.entries[]` — every capture this session returned `entries: []` because the league hadn't drafted.
- [ ] Confirm `espnReadOwnedRoster` (`lib/platforms/espn.ts`) correctly parses the real entry shape at scale (15-20+ real entries, not the 2-entry constructed fixture in `lib/platforms/espn.test.ts`).
- [ ] Confirm `entry.lineupSlotId` values actually seen in a real roster match the assumed convention (`BENCH_SLOT_IDS = {20}`, `IR_SLOT_IDS = {21}`, everything else = starting) — this convention was carried over from `lib/normalize.ts`'s pre-existing comment, not independently re-verified this session.
- [ ] Sanitize (strip real member names/GUIDs/emails) and save as a committed fixture, replacing the constructed real-player-object fixture currently in `lib/platforms/espn.test.ts`.

## 2. Real matchup scores

- [ ] Once the league has live/completed matchups, re-run `espnReadMatchup` against a real week and confirm `myScore`/`opponentScore` (derived by summing `getEspnLivePoints`'s real per-player `appliedTotal` values) match the actual score shown on ESPN's site for that matchup.
- [ ] Confirm `entry.matchupPeriodId`/`home.teamId`/`away.teamId` pairing from `getEspnMatchup`'s raw `schedule[]` still holds under a live, in-progress matchup — this was only confirmed against a preseason placeholder schedule (all-zero scores) this session.
- [ ] Investigate whether ESPN's real response ever exposes a genuine team-total-score or `winner` field (`side.totalPoints`, `cumulativeScore.score`, or similar) — this session's live capture of `mScoreboard` showed `cumulativeScore: {wins, losses, ties, scoreByStat: null, statBySlot: null}` (a season W/L tally, not a per-week point total) and truncated before reaching any field past the huge nested roster blob. If a real field is found, prefer it over the derived-sum approach and update `espnReadMatchup`'s honesty comment accordingly.
- [ ] Confirm `myProjectedScore`/`opponentProjectedScore` genuinely have no real source on this endpoint (currently reported `null`, unverified either way).
- [ ] Confirm whether ESPN exposes a pregame/live/final flag anywhere reachable (currently `status: 'unknown'`, unverified).

## 3. DEF / D-ST resolution

- [x] `ESPN_POSITION_MAP[16] === 'DEF'` — confirmed live 2026-07-17 (P3-4B) via a real, high-ownership Texans D/ST entry.
- [x] Every `proTeamId` for a team defense resolves correctly — confirmed live 2026-07-17 (P3-4B) via a complete capture of all 32 real team-defense entries' unambiguous display names (e.g. "Chiefs D/ST" → 12, "Jaguars D/ST" → 30). This capture caught and fixed two real bugs in the P3-3 `ESPN_PRO_TEAM_MAP` (12/34 both mapped to HOU; 13/30 both mapped to LV) via `lib/playerMappingSeed.ts`'s collision report during a real P3-4B dry run — see `lib/platforms/espnMaps.ts`'s header comment.
- [ ] `resolvePlayerIdentityPure`'s DEF branch (`lib/playerIdentity.ts`) has not yet been exercised against a real ESPN DEF row through the full adapter path (`espnReadOwnedRoster`/`espnReadAvailablePlayers`) — the team-ID capture above proved the *map*, not the end-to-end resolver call. Confirm once a real connected league has a DEF on a roster or in its free-agent pool.

## 4. Uncommon position/team enum values

- [x] `ESPN_POSITION_MAP` — fully confirmed live 2026-07-17 (P3-4B): all six entries (QB/1, RB/2, WR/3, TE/4, K/5, DEF/16) verified against real, >50%-owned players (Josh Allen, Jahmyr Gibbs, Puka Nacua, Brock Bowers, Brandon Aubrey, Texans D/ST).
- [x] `ESPN_PRO_TEAM_MAP` — fully confirmed live 2026-07-17 (P3-4B): all 32 mapped team IDs verified via real team-defense display names (see section 3). `proTeamId: 0` ("no team"/free agent) is still an inference, not directly observed — no real player in any fetch this session had `proTeamId 0`.
- [ ] Confirm `proTeamId: 0` really does mean "no current NFL team" against a real unsigned player once one is observed (e.g. an unsigned rookie or a player between signings) — `espnProTeamAbbrev` currently treats it as `null`, matching the "never a placeholder" rule, but the specific value `0` itself is unverified.
- [ ] `lib/platforms/espn.ts`'s `espnReadOwnedRoster`/`espnReadAvailablePlayers` pass `nflTeam ?? ''` into `resolvePlayerIdentityPure` (a temporary quirk — `PlayerIdentityInput.nflTeam` is still non-nullable) while the OUTPUT and `player_mappings` both correctly use `null` for a real free agent. Confirm this doesn't cause a real free-agent ESPN player to fail matching against a `player_mappings` row that correctly stores `nfl_team: null` — worth widening `PlayerIdentityInput.nflTeam` to `string | null` once this is hit with real data, rather than leaving the empty-string coercion in place indefinitely.

---

**When all sections pass:** update this file's Status line to reflect what's verified, and note any parser fixes made along the way in the relevant commit — don't silently correct `lib/platforms/espn.ts` without a record of what real data revealed.
