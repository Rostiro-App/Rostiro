# Rostiro Video Shotlist v1.0
## Status: DEFERRED — requires the founder to film. Not buildable by Claude Code.

> These are the three "Founder B-roll" clips referenced in `app/features/page.tsx`'s `ProductVideoDemo` call sites and in `Rostiro_Marketing_Plan_v1.md` §5. All three need real device footage of the actual product against real accounts and, for two of them, a real live NFL Sunday — none of that can be produced by an AI agent. This doc turns the one-line shot-list notes already in the code into a filmable, beat-by-beat script so shoot day has zero ambiguity. Nothing here is optional creative interpretation; shoot exactly what's below, then swap the placeholder in `ProductVideoDemo` for the real file.

**Update (2026-07-06): all three slots are temporarily filled with Remotion-rendered placeholders**, not blank "coming soon" states, so the Features page has something real to show while these are pending:
- `remotion/compositions/KickoffTransition.tsx` and `InterruptStackReveal.tsx` are motion-graphic recreations built from the actual `brandTokens.ts` colors and the real `STATE_TRANSITION_MS`/`AUTO_DISMISS_MS` timing — accurate to how the product actually behaves, just not real device footage of a real Sunday. Their captions say so ("motion-graphic recreation — real footage pending").
- `remotion/compositions/MultiLeagueConnectReenactment.tsx` is a staged walkthrough with placeholder account names, since that clip's entire point is proving real OAuth against real accounts, which can't be faked authentically. It carries a permanent on-screen "ILLUSTRATIVE REENACTMENT — NOT REAL ACCOUNT FOOTAGE" badge baked into the video itself, and its caption says the same.

**None of this changes what's below.** The real founder shoot is still deferred and still needed — these placeholders exist so the page isn't empty, not as a substitute for shooting the real thing. When the real clips are shot, replace the `src` prop on the corresponding `ProductVideoDemo` call (files live at `public/videos/`) and delete the Remotion placeholder compositions.

Rough placeholder GIFs of the underlying UI behavior also exist from an earlier pass (screen-recorded from the live dev site): `rostiro-interrupt-stack-demo.gif`, `rostiro-states-cycle-demo.gif`, `rostiro-mode-density-demo.gif`. Superseded by the Remotion renders above for on-site use; kept only for internal review.

---

## Shared shoot setup (applies to all three clips)

- **Device:** phone in hand or a tripod mount, portrait or landscape — match whichever the site's `ProductVideoDemo` frame renders (currently a landscape glass frame; shoot landscape unless that changes).
- **Screen recording:** use the phone's native screen recorder (iOS Control Center / Android Quick Settings) capturing the Rostiro app or site directly. Do not use OBS/desktop mirroring unless recording is happening on desktop — clips 1 and 3 are phone-native moments.
- **Audio:** none needed. All three are silent B-roll; captions already exist in the component (`caption` prop), no voiceover to record.
- **Accounts needed:** a real Sleeper account, a real Yahoo account, and a real ESPN account, each in at least one real league with the founder's own roster (clip 1 requires connecting all three back to back — do this connect for real, don't fake it with test data).
- **Export:** raw screen-recording .mp4 or .mov, no need to pre-edit/trim to final length — hand the raw file over and cuts can happen in post. Target final length noted per clip is what should end up on the page, not what to shoot.
- **Where the final file goes:** replace the corresponding `ProductVideoDemo` call's placeholder in `app/features/page.tsx` once edited (swap in the real video source; ping Claude Code to wire it in, that part isn't a shoot-day task).

---

## Clip 1 — Multi-league connect → unified Pulse

**Site location:** `app/features/page.tsx`, Pillar 1 (The Pulse), directly under the Interactive Pulse density demo.
**Target final length:** 30–45 seconds.
**Purpose:** proves "one list, every league" isn't a mockup — the founder's own three real leagues actually land in one Pulse feed.

**Beat-by-beat:**

1. **0:00–0:05** — Start on the onboarding "Connect your leagues" screen with zero leagues connected. Hold for a beat so the empty state reads clearly.
2. **0:05–0:15** — Tap Sleeper, connect the founder's real Sleeper account (username only, no login screen — let the no-password flow play out on camera, it's a real differentiator vs. Yahoo/ESPN).
3. **0:15–0:28** — Tap Yahoo, complete the real OAuth flow, land back on the connect screen with 2/3 connected.
4. **0:28–0:40** — Tap ESPN, complete the real cookie-based connect, land on 3/3 connected.
5. **0:40–0:45** — Tap through to Pulse. Hold on the Pulse feed for 3-4 seconds once it loads, framed so at least one card visibly names two different leagues in the same list (per the shot note: "a unified list that names all three leagues in the same card"). Don't cut away until that's legible on screen.

**What must be visible and legible, non-negotiable:**
- Each platform's real connect flow, not a skipped/mocked step.
- The final Pulse screen must show items tagged with more than one league/platform so a viewer can tell it's actually unified, not just three separate empty states stitched together.

---

## Clip 2 — Kickoff transition timelapse

**Site location:** `app/features/page.tsx`, Pillar 2 (Rostiro States).
**Target final length:** 15–20 seconds (sped up from a much longer real capture).
**Purpose:** the single most differentiated visual in the product — the whole OS visibly changing color/mode at kickoff, not a static screenshot claim.

**Beat-by-beat:**

1. Set up a locked phone or screen recording starting **5-10 minutes before the first kickoff of the founder's Game Day window** (Thursday night, Sunday 1pm slot, or Monday night — any real kickoff works, Sunday 1pm is the most legible since App traffic there is highest).
2. Frame the System Bar and Pulse header together in one shot — both need to be visible in the same frame since the transition is a two-part sweep (System Bar accent, then Pulse header re-labeling to "Mission Control").
3. Let the recording run continuously through the actual kickoff moment. Do not stop and restart — the whole point is one continuous real transition, not a before/after cut.
4. In post: speed up the dead time before kickoff (the calm Standard-state minutes), then drop back to real speed for the ~2-second sweep itself so the color/label change reads clearly instead of blurring past at speed.

**What must be visible and legible, non-negotiable:**
- The exact moment of the sweep: System Bar accent shifting from Standard's blue to Game Day's red, and the Pulse header re-labeling to "Mission Control" with the brief mono-value flicker-in. If the speed ramp obscures this ~2 second window, the clip has failed its one job — bias toward keeping this moment at real speed even if it means a longer final clip than 15-20s.

---

## Clip 3 — Interrupt Stack in action

**Site location:** `app/features/page.tsx`, Pillar 3 (Game Day Mission Control), under the Interrupt Stack description.
**Target final length:** 15–20 seconds.
**Purpose:** proves the "only the important thing interrupts you, then gets out of the way" claim with a real triggered event, not narration.

**Beat-by-beat:**

1. **0:00–0:03** — Start on a normal Game-Day-state screen, nothing interrupting, so the "before" state reads as calm.
2. **0:03** — Trigger a `touchdown_swing` scenario via the dev Simulation Panel (`components/admin/SimulationPanel.tsx` — admin-only, already built for exactly this).
3. **0:03–0:08** — Capture the Interrupt Stack card entering, clearly showing the point-delta flash and the player/team named on screen.
4. **0:08–0:14** — Hold on the card without touching anything, and let it auto-dismiss on its own (~7 second auto-dismiss per `AUTO_DISMISS_MS` in `components/InterruptStack.tsx`). The auto-dismiss has to happen on camera, unforced — that's the actual claim being demonstrated, not the card appearing.

**What must be visible and legible, non-negotiable:**
- The card must be triggered via the real Simulation Panel against the real component, not staged/mocked UI.
- The auto-dismiss must play out on its own on camera. Cutting away before it clears itself would undercut the exact claim this clip exists to prove.

---

## When these are done

Hand the three raw files off and Claude Code can wire each into its `ProductVideoDemo` call site in `app/features/page.tsx`, replacing the "Demo coming soon" placeholder state. No other code changes should be needed — the component, caption, and layout are already built and shipped.
