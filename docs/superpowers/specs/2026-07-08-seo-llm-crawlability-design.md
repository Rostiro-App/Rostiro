# SEO & LLM Crawlability Design

## Goal

Bring Rostiro's technical SEO and AI-crawlability up to the same bar as the
recently-shipped Auth/Billing/Email-suite work: real, verified, no
aspirational copy. Marketing begins in a few days (pre-season
awareness/beta-signup push, not a conversion push); this closes the gap
between what `Rostiro_Marketing_System_v1.md` §15 recommends and what the
codebase actually has today (currently: no sitemap, no robots.txt, no
structured data, no OG image, no `llms.txt`, and the homepage itself has no
dedicated metadata).

## Global Constraints

- Real fields only in all structured data — no fabricated ratings, review
  counts, or social links for accounts that don't exist yet. The marketing
  doc's own `[PLACEHOLDER]` social handles (X/TikTok/Instagram/YouTube — none
  confirmed/claimed as of this writing) are explicitly **excluded** from
  `Organization` schema's `sameAs` until real, live accounts exist.
- No screenshots — the OG image is generated from real design tokens/JSX
  (Next's `ImageResponse`), same discipline already used on `/features`.
- Canonical domain is `https://www.rostiro.com` (not the bare apex — it
  308-redirects to `www`, a lesson already paid for once in T-85's Stripe
  webhook setup; reuse that lesson here for sitemap/canonical URLs too).
- Public marketing/informational surface only. Everything under the
  `(app)`/`(dashboard)` route groups, `/api/*`, and `/admin` stays out of
  the sitemap and disallowed in robots.txt — those are private product
  surfaces, not marketing content.
- No new npm dependencies — everything here uses Next.js's built-in
  metadata/sitemap/robots/opengraph-image file conventions.

## Section 1: Sitemap & robots.txt

**`app/sitemap.ts`** (Next's typed `MetadataRoute.Sitemap` convention,
generated at build time). Includes:
- `/`, `/features`, `/faq`, `/pricing` (new, Section 6), `/terms`,
  `/privacy`, `/signup`, `/login`, `/forgot-password`

Excluded: everything under `(app)`/`(dashboard)`, `/api/*`, `/admin/*`,
`/onboarding`, `/reset-password` (both token-gated, no organic search
value — a page that requires a specific one-time token in the URL has
nothing indexable to rank).

**`app/robots.ts`** (Next's typed `MetadataRoute.Robots` convention):
- `Disallow`: `/api/`, the private app-group paths, `/admin`
- Explicit `Allow` entries for both categories of AI crawler, rather than
  relying on default-allow, so the intent is unambiguous to anyone (or
  anything) reading the file:
  - Training bots: `GPTBot`, `CCBot`, `Google-Extended`, `ClaudeBot`
  - Answer/citation bots: `OAI-SearchBot`, `ChatGPT-User`, `PerplexityBot`
- References `sitemap.xml` at `https://www.rostiro.com/sitemap.xml`

## Section 2: Per-page metadata + canonical URLs

- Root layout (`app/layout.tsx`) gets `metadataBase: new URL('https://www.rostiro.com')`
  so every relative OG/canonical URL resolves correctly regardless of which
  page renders it.
- Homepage (`app/page.tsx`) gets its own `metadata` export — currently
  missing entirely, silently inheriting the generic root layout copy on
  the single highest-value page. Title/description drawn from the "What is
  Rostiro?" copy already drafted in the marketing doc (§15), not invented
  fresh.
- New `/pricing` page (Section 6) gets its own title/description.
- Every public page gets `alternates: { canonical: '<page's own www URL>' }`
  to remove any `www`/apex duplicate-content ambiguity.

## Section 3: OG / Twitter card image

- `app/opengraph-image.tsx` using Next's built-in `ImageResponse`
  (JSX-to-image, same "real tokens, no screenshots" discipline as
  `/features`): dark navy background (brand kit's `--void`), the ROSTIRO
  wordmark + icon, tagline "Run Every League." — matching the email
  shell's existing brand treatment (`lib/resend.ts`'s `emailShell()`) for
  visual consistency across every surface that shares a Rostiro link.
- `app/twitter-image.tsx` re-exports the same generator (X falls back to
  `og:image` regardless, but an explicit one removes ambiguity).
- Static 1200×630, generated once at build time — nothing per-request or
  personalized in it.

## Section 4: Structured data (JSON-LD)

- **`Organization`** (root layout, site-wide): `name`, `url`, `logo`,
  `description` — real fields only. No `sameAs` yet (see Global
  Constraints).
- **`FAQPage`** (`/faq`): mapped from the existing `FaqGroup`/question data
  in `app/faq/page.tsx`. Real wrinkle: answers are currently JSX (`<p>`,
  sometimes with inline links), but schema.org requires plain text. Add a
  parallel plain-text `answerText: string` field per question in the
  existing data structure, authored once per question, used only for the
  schema — kept in sync manually since FAQ content changes rarely (same
  low-churn assumption the codebase already makes about this page).
- **`SoftwareApplication`** (`/pricing` and `/features`): real fields
  only — `name`, `applicationCategory`, the 4 actual tiers (Free/Pro/Season
  Pass/Founding 500) as `offers` with real prices. No fabricated
  `aggregateRating` or review counts — the marketing doc explicitly warns
  against this exact fabrication.

## Section 5: `llms.txt`

A single plain-markdown file at `/llms.txt`, served via
`app/llms.txt/route.ts` returning `text/plain` (not a static `public/`
file, so it can be generated from the same source-of-truth copy used
elsewhere rather than drifting). Short, structured summary: what Rostiro
is, links to `/features`, `/pricing`, `/faq`, and a one-line note on what's
real today vs. not yet built — mirrors this codebase's existing "no
aspirational copy" discipline (same bar as `/privacy`'s "checked against
what the product actually does today" comment). No `llms-full.txt` — that
convention is for much larger sites; Rostiro's entire public surface is a
handful of pages, so one file covers it without a second copy to keep in
sync.

## Section 6: Dedicated `/pricing` page

Extract the existing `PricingSection()` function out of `app/page.tsx`
into a shared component, `components/marketing/PricingSection.tsx`.
Rendered in the same visual position on the homepage (no visual change
there) and mounted as the entire content of the new `app/pricing/page.tsx`,
which adds its own metadata (Section 2) and `SoftwareApplication`/`Offer`
schema (Section 4). Purely an extraction + new mount point — no pricing
logic, copy, or tier changes.

## Testing / Verification

No automated test framework in this repo (consistent with the rest of the
codebase) — verification is manual, same posture as the email suite:
- `npx next build` succeeds, `/sitemap.xml`, `/robots.txt`, `/llms.txt`,
  `/opengraph-image`, and `/pricing` all render.
- Sitemap URLs match the actual public route list above — no private
  routes leaked in, no public route missing.
- robots.txt disallow list matches; AI bot allow entries present.
- Each JSON-LD block validates against Google's Rich Results Test /
  schema.org validator, with real values (no placeholder text left in).
- OG image renders correctly when a `/` or `/pricing` link is pasted into
  a real client that shows link previews (e.g. iMessage, Slack, X compose).

## Out of Scope (explicitly, not forgotten)

- **Blog** — a genuinely separate, bigger initiative (needs a content
  system, not just config); the 5 blog-post ideas in the marketing doc
  §15 have nowhere to live yet. Future project.
- **Google Search Console verification** — requires creating an external
  GSC property first (an account action, not a code change); add the
  verification meta tag to `app/layout.tsx`'s metadata once a
  verification code exists.
- **Social account `sameAs` links** — add once the marketing doc's
  `[PLACEHOLDER]` handles are actually claimed and live.
- **Comparison pages, "how it works" page** — mentioned in the marketing
  doc but not part of tonight's technical-SEO push; separate content work.
