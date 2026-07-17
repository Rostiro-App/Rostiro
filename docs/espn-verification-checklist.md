# ESPN Intelligence Adapter — Deferred Verification Checklist

**Status:** partially verified. `lib/platforms/espn.ts` was built from real, live-captured ESPN Fantasy API responses (session of 2026-07-17, league 799979 "10th Annual Broome St League", a real user league) — but that league had not yet drafted at capture time, which blocks several items below from being verified against real data. This is the root cause behind every unchecked item; do not work around it with synthetic fixtures or by relaxing the implementation to make a check appear to pass.

**Do not edit the Packet 03 ESPN adapter to make any of these appear complete.** If a real run reveals the implementation is wrong, fix the implementation and re-run the check — don't adjust the check to match whatever the code currently does.

**When league 799979 (or another connected ESPN league) actually drafts**, work through this list top to bottom.

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

- [ ] Confirm `resolvePlayerIdentityPure`'s DEF branch (`lib/playerIdentity.ts`) correctly resolves a real ESPN team defense entry — no DEF/D-ST player was present in any real capture this session (`kona_player_info`'s captured sample was 3 offensive skill players; the constructed roster fixture has none either).
- [ ] Confirm `ESPN_POSITION_MAP[16] === 'DEF'` and the specific `proTeamId` for that defense's team resolve correctly — this is the single highest-risk entry in `ESPN_POSITION_MAP`/`ESPN_PRO_TEAM_MAP`, per `lib/platforms/espn.ts`'s own comment, since a wrong proTeamId here would misresolve identity entirely rather than just degrade a display field.

## 4. Uncommon position/team enum values

- [ ] `ESPN_POSITION_MAP` only directly spot-checked `2` (RB) and `3` (WR) against real players this session. Confirm `1` (QB), `4` (TE), `5` (K), and `16` (DEF) against real captured players before trusting them in production.
- [ ] `ESPN_PRO_TEAM_MAP` only directly spot-checked `6` (NYJ), `11` (IND), `14` (LAR), `15` (MIA), `30` (LV) this session. Confirm the remaining ~27 team IDs against real players, particularly any team whose abbreviation differs from what's commonly documented (e.g. Washington/`WSH` naming has changed across ESPN API versions historically).
- [ ] Note: a wrong entry in either map degrades a player's *displayed* position/team, it does not by itself break identity resolution for non-DEF players — `resolvePlayerIdentityPure` falls back to name-only matching when position/team don't line up. Confirm this fallback actually fires correctly for a real mismapped case before assuming it's a low-severity gap in practice.

---

**When all four sections pass:** update this file's Status line to reflect what's verified, and note any parser fixes made along the way in the relevant commit — don't silently correct `lib/platforms/espn.ts` without a record of what real data revealed.
