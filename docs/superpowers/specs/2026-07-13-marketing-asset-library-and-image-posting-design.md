# Marketing asset library & image posting — design

**Date:** 2026-07-13
**Companion to:** `docs/superpowers/specs/2026-07-12-operator-cockpit-and-alerts-design.md` (Subsystem B, the cockpit) and `docs/postiz-setup.md` in the `rostiro-cockpit` repo.

## Problem

The cockpit's Marketing agent (`src/agents/marketing.ts` in `rostiro-cockpit`) can currently only draft and post **text**. Two capabilities are missing that block the actual desired growth UX — "find an image of Rostiro Pulse and post about the Davante Adams touchdown; bring back the image, caption, and settings for my approval":

1. **No shared, searchable asset library.** Today's clip library is a local, manual Google Drive folder — the cloud cockpit has no access to it.
2. **No image production or attachment path.** The agent has no way to produce an image, and `postiz_create_post` (`postizTool.ts`) has no media parameter — confirmed by reading the tool's actual `zod` schema (`content`, `integrationIds`, `type`, `scheduleDate` only).

## Decisions from brainstorming

- **Image source, per post:** the agent may use either (a) a real screenshot of Rostiro's own product (never a synthesized photo of a real player — that would violate the existing honesty-contract prompt and create trademark/right-of-publicity risk), or (b) a templated, data-driven stat/quote card. Agent picks whichever fits per post.
- **Shared storage:** **Supabase Storage**, not Google Drive. Reuses the Supabase project already wired into the cockpit; no new OAuth integration to build; the tagging index lives naturally beside it in the same database.
- **Screenshot sourcing for this phase:** the agent **searches assets you've already captured and uploaded** (same Screen Studio / Simulation Studio workflow as today). It does **not** drive the Studio itself headlessly to capture fresh screenshots on demand — that is a distinct, larger capability (browser automation inside the Fly container) explicitly deferred to a **Week 2–3 follow-on design**.
- **Card generation:** a **templated HTML/CSS renderer** filled with real data → PNG. No third-party AI image-generation API. This was a deliberate choice: an image-gen API prompted for "a touchdown moment" risks depicting a real player's likeness without rights and produces visually inconsistent, off-brand results — a genuine legal and brand-consistency risk, not just a nice-to-have avoided. The templated approach is deterministic and can never fabricate a photo of a real person.

## Architecture

### New Supabase pieces
- **Storage bucket `marketing-assets`**, with two prefixes:
  - `screenshots/` — real captures you upload (Studio/Screen Studio output).
  - `generated/` — stat/quote cards the agent renders.
- **New table `marketing_assets`** (this project's own table, not part of the live app schema):
  - `id, storage_path, kind ('screenshot' | 'generated_card'), pillar, player_tags text[], topic, aspect, description, created_at`.
  - This is the actual searchable index. "Find an image of Rostiro Pulse" is a query against this table (`pillar`/`topic`/`player_tags` match), not a blind storage crawl.
- **Access scope:** the cockpit's existing Supabase MCP connection is deliberately read-only against the live app's production tables (`docs/security-posture.md`). `marketing_assets` is a new, non-production, agent-owned table with a different risk profile (marketing housekeeping, not user data) — it gets its own narrowly-scoped read/write credential, kept separate from the production read-only connection so the existing safety property ("cockpit cannot write production data") is untouched.

### New Marketing-agent tools (added in `rostiro-cockpit`, alongside the existing Postiz tools)
- **`asset_search(query)`** — queries `marketing_assets` by pillar/player/topic keyword, returns candidates with signed Supabase Storage URLs.
- **`generate_stat_card(data, template)`** — renders a small branded HTML/CSS template (Rostiro's existing brand tokens/logo, `lib/brandTokens.ts` as the source of truth for colors) filled with the given real data into a PNG (exact rendering library — e.g. `satori`+`resvg-js` vs. headless Chromium — is an implementation-plan decision, not fixed here), uploads it to `generated/`, and inserts a `marketing_assets` row tagged `kind=generated_card`.

### Extensions to existing code
- **`postizTool.ts`'s `postiz_create_post`** gains a media parameter: given a `marketing_assets` row (or its storage URL), upload it to Postiz's own media endpoint, then reference it in the post body. This is the same "verify against Postiz's real API once live" caveat already flagged for this file — the exact upload endpoint/shape must be confirmed once Postiz is actually running, not guessed.
- **`permissionGate.ts`'s Discord approval flow** (`askForApproval`) attaches the actual image file to the Discord message, alongside the caption text, target platform(s)/integration IDs, and schedule time — replacing today's JSON-only preview for this action. The `go <id>` / `cancel <id>` mechanism is unchanged.
- **`marketing.ts`'s system prompt** gets an added instruction: prefer a real, relevant existing screenshot when one exists; otherwise generate a stat card from real data already available (Rostiro's own `pulse_items`/`news_items` via the existing read-only connection, or data the operator supplies directly in chat); never fabricate a stat, event, or player depiction that isn't real.

## Data flow — worked example

> "Find an image of Rostiro Pulse and post about the Davante Adams touchdown."

1. Operator messages the cockpit in Discord `#cockpit`.
2. Delegated to the Marketing agent.
3. Agent calls `asset_search` for a Pulse-tagged screenshot matching the moment.
   - If found: uses it directly.
   - If not: pulls real event data already available (Supabase read access or operator-supplied) and calls `generate_stat_card`.
4. Agent drafts caption text per the existing brand-voice/honesty-contract rules.
5. Agent posts a Discord approval message: image attached + caption + target platform(s) + proposed schedule time, with `go <id>` / `cancel <id>`.
6. Operator replies `go <id>`.
7. `postiz_create_post` runs with the media reference, caption, integrations, and schedule — Postiz publishes/schedules the real post.

## Error handling

- No matching screenshot **and** no real data available to build a card → the agent says so explicitly and asks the operator for the specific stat/source. It never invents one.
- Storage upload failure, `marketing_assets` write failure, or Postiz media-upload failure → surfaced as a visible error in Discord. No silent retry, no silent fallback to placeholder content.
- All of the above are still subject to the existing `permissionGate.ts` floor: a real publish always requires `go`, in every mode except `readonly` (unchanged from the current design).

## Testing plan

1. Upload one sample real screenshot to `marketing-assets/screenshots/`, tag it in `marketing_assets`, confirm `asset_search` retrieves it for a matching query.
2. Generate one stat card from known dummy (clearly-labeled-as-test) data; visually confirm the template renders on-brand.
3. Full dry run in `!mode propose`: drive the whole pipeline through to the Discord approval message (image attached, caption, platforms, schedule) and reply `cancel` — proving the pipeline works without ever publishing.
4. Only once Postiz's real media-upload endpoint is confirmed against its live docs (a pre-existing, still-open caveat from the original Postiz integration) does a real throwaway post go to a low-stakes/test account.

## Explicitly out of scope for this phase

- Headless/on-demand Studio capture (agent drives `/demo/studio` itself to produce a fresh screenshot) — deferred to a Week 2–3 follow-on design.
- Any third-party AI image-generation API — deliberately not used, for the legal/brand-consistency reasons above.
- Multi-image carousels, video attachment, and Stories-specific formatting — this phase covers single-image posts only; video attachment for existing Studio clips is a natural follow-on once the media-upload path is proven with images.
