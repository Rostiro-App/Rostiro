# Yahoo Integration — Deferred Verification Checklist

**Status:** blocked. **Blocker:** Yahoo has not yet approved read access for this app's registration — confirmed directly by the founder (2026-07-17). No OAuth flow can complete until that changes, so none of the items below can be verified today. This is the single root cause behind every checkbox here; do not attempt to work around it with synthetic fixtures or by relaxing the implementation to make a check appear to pass.

**Do not edit the Packet 02 implementation to make any of these appear complete.** If a real run reveals the implementation is wrong, fix the implementation and re-run the check — don't adjust the check to match whatever the code currently does.

**When Yahoo approves access**, work through this list top to bottom. Each item names the exact file/route it verifies and what "pass" means concretely.

---

## 1. Real fixture capture

- [ ] Complete a real OAuth flow (`/api/auth/yahoo` → Yahoo consent → `/api/auth/yahoo/callback`) with a real Yahoo account that has at least one current-season NFL league.
- [ ] Capture the raw JSON response (before normalization) for each of: user's league collection, single league settings, league teams, owned team roster, draft results.
- [ ] Sanitize (strip tokens, GUIDs, emails, private league metadata) and save as fixtures, replacing the `UNVERIFIED`-labeled synthetic shapes in `lib/normalize.test.ts`.
- [ ] Re-run `lib/normalize.test.ts` and `lib/platforms/yahoo.test.ts` against the real fixtures. Fix any shape mismatch in `lib/normalize.ts`'s parsers.

## 2. OAuth

- [ ] Confirm the Yahoo consent screen shows **read-only** permission (not read/write).
- [ ] Confirm `lib/yahoo.ts`'s `isReadCompatibleScope` check passes on the real granted scope (should be `fspt-r` or Yahoo's real equivalent string — confirm it matches what's hardcoded).
- [ ] Confirm the callback redirects to `/onboarding?yahoo=connected` and a `yahoo_tokens` row exists (service_role only — verify via Supabase dashboard, not a client query).
- [ ] Trigger a bad `state` param manually (e.g. stale cookie) and confirm it fails safely to `?error=yahoo_auth_failed`, not a crash.

## 3. League import

- [ ] `POST /api/leagues/yahoo` with a real token: confirm every current-season NFL league the account owns is returned in `imported`.
- [ ] Confirm each imported `connected_leagues` row has real (non-placeholder) `league_name`, `scoring_settings_json`, `roster_slots_json`, `season`.
- [ ] Confirm `extractYahooLeagueKeys` (`lib/normalize.ts`) correctly parses the real collection shape — this is the highest-risk unverified parser (no existing normalizer covered this shape before Packet 02).

## 4. Owned-team detection

- [ ] Confirm `extractYahooOwnedTeam` (`lib/normalize.ts`) correctly identifies the caller's own team via `is_owned_by_current_login`, not team index 0, across at least one league where the user's team isn't first in the response.
- [ ] Confirm `team_id`/`team_name` on the resulting `connected_leagues` row match the real team, not a different manager's.

## 5. Resync (idempotency)

- [ ] Call `POST /api/leagues/yahoo` twice in a row. Confirm the second call reports `updated`, not `imported`, for every league, and no duplicate `connected_leagues` rows appear (check the unique constraint on `(user_id, platform, league_id, season)` actually held).

## 6. Reconnect

- [ ] Revoke the app's access from the Yahoo account side (or let the token expire past Yahoo's refresh grace window).
- [ ] Confirm `GET /api/leagues/yahoo` reports `needsReconnect: true` and the Settings UI (`YahooConnectionPanel`) shows "Reconnect required" with a working Reconnect control, not a silent failure.
- [ ] Confirm reconnecting does **not** delete previously-imported league history.

## 7. Disconnect

- [ ] `DELETE /api/leagues/yahoo`: confirm the `yahoo_tokens` row and all `platform = 'yahoo'` `connected_leagues` rows for that user are removed.
- [ ] Confirm Sleeper/ESPN connections for the same user are completely untouched.

## 8. Player matching

- [ ] Run real Yahoo roster/player data through `lib/playerIdentity.ts`'s `resolvePlayerIdentity`. Spot-check: a well-known player resolves `exact` or `name_team`, not `unresolved`.
- [ ] Confirm at least one team defense resolves correctly (position `DEF` path).
- [ ] Confirm the resolver's `warnings` (from `toNormalizedYahooLeague`) actually fire when real Yahoo data has a field the parser can't confidently read — don't assume the synthetic warning tests generalize.

## 9. Draft metadata

- [ ] Confirm `parseYahooDraftInfo` (`lib/normalize.ts`) correctly reads a real league's `draft_status`/`draft_time` — verify against a league in each state Yahoo actually uses (predraft, drafting if catchable, postdraft), since only the field *names* were confirmed via documentation, not their real values in context.

## 10. Waiver metadata

- [ ] Confirm `parseYahooWaiverSettings` correctly reads a real league's `waiver_type`/`uses_faab`/`faab_balance`. Confirm at least one FAAB league and one non-FAAB (rolling/reverse-standings) league both parse correctly.
- [ ] Decide, with real data in hand, whether `waiver_time`'s semantics are confident enough to ever map onto `connected_leagues.waiver_cutoff_day/hour` — Packet 02 deliberately left this unmapped due to unverified semantics; don't wire it up without resolving that first.

---

**When all ten sections pass:** update this file's Status line to reflect what's verified, and note any parser fixes made along the way in the relevant commit — don't silently correct `lib/normalize.ts` without a record of what real data revealed.
