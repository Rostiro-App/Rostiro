# SEO & LLM Crawlability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring Rostiro's technical SEO and AI-crawlability up to par with the recently-shipped Auth/Billing/Email-suite work: sitemap, robots.txt, per-page metadata, an OG image, structured data (Organization/FAQPage/SoftwareApplication), `llms.txt`, and a dedicated `/pricing` page.

**Architecture:** All-native Next.js App Router conventions (`app/sitemap.ts`, `app/robots.ts`, `app/opengraph-image.tsx`, route-handler `app/llms.txt/route.ts`), no new dependencies. Structured data is inline `<script type="application/ld+json">` tags per page. `PricingSection` is extracted from the homepage into a shared component so both `/` and the new `/pricing` render identical content from one source.

**Tech Stack:** Next.js 16 App Router metadata/sitemap/robots/opengraph-image file conventions, `next/og`'s `ImageResponse`.

## Global Constraints

- Canonical domain is `https://www.rostiro.com` (not the bare apex — it 308-redirects to `www`; Stripe's webhook already paid for this lesson once in T-85, reuse it here).
- Real fields only in all structured data — no fabricated ratings, review counts, or social `sameAs` links. The marketing doc's X/TikTok/Instagram/YouTube handles are all `[PLACEHOLDER]` (unclaimed) as of this plan — omit `sameAs` entirely until real accounts exist.
- No screenshots in the OG image — build it from real brand tokens/shapes (matches `/features`' existing "no screenshots" rule).
- Sitemap/robots-allow list covers only the public marketing surface: `/`, `/features`, `/faq`, `/pricing`, `/terms`, `/privacy`, `/signup`, `/login`, `/forgot-password`. Everything else (private app routes, `/api/*`, `/admin`) is excluded from the sitemap and disallowed in robots.txt.
- Private app top-level paths to disallow (confirmed via `app/(app)/*` and `app/(dashboard)/*`): `/dashboard`, `/draft`, `/pulse`, `/start-sit`, `/trade`, `/admin`, `/leagues`, `/lineup`, `/live`, `/profile`, `/settings`, `/trades`, `/upgrade`.
- robots.txt explicitly allows both AI training bots (`GPTBot`, `CCBot`, `Google-Extended`, `ClaudeBot`) and AI answer/citation bots (`OAI-SearchBot`, `ChatGPT-User`, `PerplexityBot`), per founder's explicit call to maximize AI-assistant discoverability during the pre-launch awareness push.
- No automated test framework in this repo — verification is `npx next build` plus manually inspecting each generated route's real output (same posture as the email suite).

---

## Task 1: Sitemap & robots.txt

**Files:**
- Create: `app/sitemap.ts`
- Create: `app/robots.ts`

**Interfaces:**
- Produces: nothing consumed by later tasks — self-contained.

- [ ] **Step 1: Write `app/sitemap.ts`**

```typescript
import type { MetadataRoute } from 'next'

const BASE_URL = 'https://www.rostiro.com'

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date()

  return [
    { url: BASE_URL, lastModified: now, changeFrequency: 'weekly', priority: 1 },
    { url: `${BASE_URL}/features`, lastModified: now, changeFrequency: 'monthly', priority: 0.9 },
    { url: `${BASE_URL}/pricing`, lastModified: now, changeFrequency: 'monthly', priority: 0.9 },
    { url: `${BASE_URL}/faq`, lastModified: now, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${BASE_URL}/signup`, lastModified: now, changeFrequency: 'yearly', priority: 0.6 },
    { url: `${BASE_URL}/login`, lastModified: now, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${BASE_URL}/forgot-password`, lastModified: now, changeFrequency: 'yearly', priority: 0.1 },
    { url: `${BASE_URL}/terms`, lastModified: now, changeFrequency: 'yearly', priority: 0.2 },
    { url: `${BASE_URL}/privacy`, lastModified: now, changeFrequency: 'yearly', priority: 0.2 },
  ]
}
```

- [ ] **Step 2: Write `app/robots.ts`**

```typescript
import type { MetadataRoute } from 'next'

const BASE_URL = 'https://www.rostiro.com'

// Private app surfaces + API — no SEO value, nothing here should be
// crawled or indexed. See Global Constraints for how this list was derived.
const DISALLOWED = [
  '/api/',
  '/dashboard',
  '/draft',
  '/pulse',
  '/start-sit',
  '/trade',
  '/admin',
  '/leagues',
  '/lineup',
  '/live',
  '/profile',
  '/settings',
  '/trades',
  '/upgrade',
  '/onboarding',
  '/reset-password',
]

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: DISALLOWED,
      },
      // AI training bots — explicitly allowed per founder's call to
      // maximize pre-launch awareness, not left to default-allow.
      { userAgent: 'GPTBot', allow: '/', disallow: DISALLOWED },
      { userAgent: 'CCBot', allow: '/', disallow: DISALLOWED },
      { userAgent: 'Google-Extended', allow: '/', disallow: DISALLOWED },
      { userAgent: 'ClaudeBot', allow: '/', disallow: DISALLOWED },
      // AI answer/citation bots — fetch pages live to answer a specific
      // user's question and cite Rostiro.
      { userAgent: 'OAI-SearchBot', allow: '/', disallow: DISALLOWED },
      { userAgent: 'ChatGPT-User', allow: '/', disallow: DISALLOWED },
      { userAgent: 'PerplexityBot', allow: '/', disallow: DISALLOWED },
    ],
    sitemap: `${BASE_URL}/sitemap.xml`,
  }
}
```

- [ ] **Step 3: Verify it builds and generates real output**

Run: `npx next build 2>&1 | grep -iE "sitemap|robots|error"`
Expected: no errors; the build's route table lists `/sitemap.xml` and `/robots.txt`.

Then run: `npx next dev &` (or reuse a running dev server) and:
```bash
curl -s http://localhost:3000/sitemap.xml | head -20
curl -s http://localhost:3000/robots.txt
```
Expected: real XML with all 9 URLs from Step 1, and real robots rules matching Step 2 — no template/placeholder text.

- [ ] **Step 4: Commit**

```bash
git add app/sitemap.ts app/robots.ts
git commit -m "feat(seo): add sitemap.xml and robots.txt"
```

---

## Task 2: Homepage metadata + metadataBase + canonical URLs

**Files:**
- Modify: `app/layout.tsx`
- Modify: `app/page.tsx`
- Modify: `app/features/page.tsx`
- Modify: `app/faq/page.tsx`
- Modify: `app/privacy/page.tsx`
- Modify: `app/terms/page.tsx`

**Interfaces:**
- Consumes: nothing from Task 1.
- Produces: `metadataBase` set site-wide; every public page below has `alternates.canonical` — later tasks (OG image, Task 3) rely on `metadataBase` being set so relative image URLs resolve.

- [ ] **Step 1: Add `metadataBase` to the root layout**

In `app/layout.tsx`, change:
```typescript
export const metadata: Metadata = {
  title: "Rostiro: Run Every League.",
  description: "The operating system for fantasy sports. Manage every league in one place.",
};
```
to:
```typescript
export const metadata: Metadata = {
  metadataBase: new URL('https://www.rostiro.com'),
  title: "Rostiro: Run Every League.",
  description: "The operating system for fantasy sports. Manage every league in one place.",
};
```

- [ ] **Step 2: Give the homepage its own metadata + canonical**

`app/page.tsx` currently has no `metadata` export at all — it inherits the generic root layout copy. Add, immediately after the existing top-of-file comment block and before the `import Link from 'next/link'` line:

```typescript
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Rostiro: The Operating System for Fantasy Football',
  description: "Rostiro brings every league you're in, across ESPN, Yahoo, and Sleeper, into one ranked daily action list. One health score per team, reshaped around the real fantasy calendar from draft day through your league's real championship. Free to start.",
  alternates: { canonical: 'https://www.rostiro.com' },
}
```

- [ ] **Step 3: Add canonical URLs to the other 4 public pages**

In `app/features/page.tsx`, change:
```typescript
export const metadata = {
  title: 'Features · Rostiro',
  description: 'The operating system for fantasy sports: one Pulse across every league, a weekly cycle that reshapes itself, and Game Day Mission Control.',
}
```
to:
```typescript
export const metadata = {
  title: 'Features · Rostiro',
  description: 'The operating system for fantasy sports: one Pulse across every league, a weekly cycle that reshapes itself, and Game Day Mission Control.',
  alternates: { canonical: 'https://www.rostiro.com/features' },
}
```

In `app/faq/page.tsx`, change:
```typescript
export const metadata = {
  title: 'FAQ · Rostiro',
  description: 'Answers on how Rostiro works with ESPN, Yahoo, and Sleeper, what Focused/Balanced/Savant modes mean, and how your league credentials are secured.',
}
```
to:
```typescript
export const metadata = {
  title: 'FAQ · Rostiro',
  description: 'Answers on how Rostiro works with ESPN, Yahoo, and Sleeper, what Focused/Balanced/Savant modes mean, and how your league credentials are secured.',
  alternates: { canonical: 'https://www.rostiro.com/faq' },
}
```

In `app/privacy/page.tsx`, change:
```typescript
export const metadata = {
  title: 'Privacy Policy | Rostiro',
}
```
to:
```typescript
export const metadata = {
  title: 'Privacy Policy | Rostiro',
  alternates: { canonical: 'https://www.rostiro.com/privacy' },
}
```

In `app/terms/page.tsx`, change:
```typescript
export const metadata = {
  title: 'Terms of Service · Rostiro',
}
```
to:
```typescript
export const metadata = {
  title: 'Terms of Service · Rostiro',
  alternates: { canonical: 'https://www.rostiro.com/terms' },
}
```

(`/pricing`'s own metadata + canonical is added in Task 4, when the page is created.)

- [ ] **Step 4: Verify it builds**

Run: `npx next build 2>&1 | grep -iE "error|page.tsx|layout.tsx"`
Expected: no errors referencing any of the 6 modified files.

- [ ] **Step 5: Commit**

```bash
git add app/layout.tsx app/page.tsx app/features/page.tsx app/faq/page.tsx app/privacy/page.tsx app/terms/page.tsx
git commit -m "feat(seo): add homepage metadata, metadataBase, and canonical URLs"
```

---

## Task 3: OG / Twitter card image

**Files:**
- Create: `app/opengraph-image.tsx`
- Create: `app/twitter-image.tsx`

**Interfaces:**
- Consumes: `metadataBase` from Task 2 (so the generated image URL resolves as an absolute URL in page `<head>` output).
- Produces: nothing consumed by later tasks.

- [ ] **Step 1: Write `app/opengraph-image.tsx`**

```typescript
import { ImageResponse } from 'next/og'

export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#060B13',
          fontFamily: 'sans-serif',
        }}
      >
        <svg width="120" height="120" viewBox="0 0 256 256">
          <rect width="256" height="256" rx="18" fill="#378ADD" />
          <polyline
            points="40,128 92,128 112,88 132,172 152,128 216,128"
            fill="none"
            stroke="#FFFFFF"
            strokeWidth="14"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <div
          style={{
            marginTop: 32,
            fontSize: 56,
            fontWeight: 700,
            letterSpacing: '-0.02em',
            color: '#E8F0F8',
          }}
        >
          ROSTIRO
        </div>
        <div
          style={{
            marginTop: 12,
            fontSize: 28,
            color: '#8FA9C0',
          }}
        >
          Run Every League.
        </div>
      </div>
    ),
    { ...size }
  )
}
```

- [ ] **Step 2: Write `app/twitter-image.tsx`**

```typescript
export { default, size, contentType } from './opengraph-image'
```

- [ ] **Step 3: Verify it builds and renders**

Run: `npx next build 2>&1 | grep -iE "opengraph|twitter|error"`
Expected: no errors; build output lists `/opengraph-image` as a generated route.

Then, with a dev server running:
```bash
curl -s -o /tmp/og-check.png -w "%{http_code} %{content_type}\n" http://localhost:3000/opengraph-image
file /tmp/og-check.png
```
Expected: `200 image/png`, and `file` reports a valid PNG image, 1200x630.

- [ ] **Step 4: Commit**

```bash
git add app/opengraph-image.tsx app/twitter-image.tsx
git commit -m "feat(seo): add generated OG/Twitter card image"
```

---

## Task 4: Extract `PricingSection`, add dedicated `/pricing` page

**Files:**
- Create: `components/marketing/PricingSection.tsx`
- Modify: `app/page.tsx` (remove inline `PricingSection`, import the shared one)
- Create: `app/pricing/page.tsx`

**Interfaces:**
- Produces: `PricingSection` (default export, no props) from `components/marketing/PricingSection.tsx` — consumed by both `app/page.tsx` and `app/pricing/page.tsx`, and by Task 5's `SoftwareApplication` schema (which needs the same 4 tiers' data).

- [ ] **Step 1: Create `components/marketing/PricingSection.tsx`**

Move the existing `PricingSection` function out of `app/page.tsx` verbatim, with `'use client'` NOT needed (no hooks/interactivity — it's already a plain server-renderable function), and export it as the default export:

```typescript
// Extracted from app/page.tsx (T-66/T-112 pricing model: Free / Rostiro
// Pro / Founder Season Pass / Founding 500) so both the homepage and the
// dedicated /pricing page render identical content from one source.

import Link from 'next/link'

export default function PricingSection() {
  const plans = [
    {
      name: 'Free',
      price: '$0',
      period: '',
      includes: ['1 league', 'Draft Kit', 'Daily Pulse', '3 start/sit calls a week', '3 trade checks a week'],
      cta: 'Start free',
      highlight: false,
    },
    {
      name: 'Rostiro Pro',
      price: '$9.99',
      period: '/mo',
      includes: ['Unlimited leagues', 'Full Pulse, every morning', 'Unlimited AI calls', 'Game Day live scores + push alerts', 'Waiver Day FAAB + Film Room recaps'],
      cta: 'Get started',
      highlight: true,
    },
    {
      name: '2026 Founder Season Pass',
      price: '$59',
      period: 'full season',
      includes: ['Everything in Rostiro Pro', 'Locked for the entire 2026 season', 'Launch-window pricing, won’t be offered again'],
      cta: 'Claim your season',
      highlight: false,
      badge: 'Launch window only',
    },
    {
      name: 'Founding 500',
      price: '$149',
      period: 'lifetime',
      includes: ['Everything in Rostiro Pro, for life', 'Founder badge', 'Priority feedback access', 'Early feature previews'],
      cta: 'Claim your spot',
      highlight: false,
      badge: 'First 500 only',
    },
  ]

  return (
    <section className="px-4 md:px-6 py-16 md:py-20">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-10">
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight" style={{ color: 'var(--t1)' }}>
            Start free. Upgrade when it&apos;s already paying for itself.
          </h2>
          <p className="text-sm mt-3" style={{ color: 'var(--t3)' }}>
            The Founder tiers are launch-window pricing: once the window closes, or the first 500 sell out, they&apos;re gone for good.
          </p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className="rounded-xl p-6 flex flex-col"
              style={{
                backgroundColor: 'var(--glass-solid)',
                border: plan.highlight ? '1px solid var(--signal)' : '1px solid var(--hairline)',
              }}
            >
              {(plan.highlight || plan.badge) && (
                <span
                  className="mono-data text-[10px] font-bold tracking-[0.12em] uppercase mb-3 self-start px-2 py-0.5 rounded"
                  style={
                    plan.highlight
                      ? { backgroundColor: 'var(--signal)', color: 'white' }
                      : { backgroundColor: 'rgba(245,200,66,0.14)', color: '#F5C842' }
                  }
                >
                  {plan.highlight ? 'Most popular' : plan.badge}
                </span>
              )}
              <h3 className="text-base font-bold" style={{ color: 'var(--t1)' }}>{plan.name}</h3>
              <p className="mt-1">
                <span className="mono-data text-2xl font-bold" style={{ color: 'var(--t1)' }}>{plan.price}</span>
                <span className="mono-data text-sm ml-1" style={{ color: 'var(--t4)' }}>{plan.period}</span>
              </p>
              <ul className="mt-4 space-y-2 flex-1">
                {plan.includes.map((item) => (
                  <li key={item} className="text-sm flex items-start gap-2" style={{ color: 'var(--t2)' }}>
                    <span style={{ color: 'var(--signal)' }}>&#10003;</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
              <Link
                href="/signup"
                className="text-sm font-semibold px-4 py-2.5 rounded-lg text-center transition-all mt-6 hover:brightness-110"
                style={{
                  backgroundColor: plan.highlight ? 'var(--cta)' : 'var(--glass)',
                  color: plan.highlight ? 'white' : 'var(--t1)',
                }}
              >
                {plan.cta}
              </Link>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
```

- [ ] **Step 2: Remove the inline `PricingSection` from `app/page.tsx`, import the shared one**

In `app/page.tsx`, delete the entire `PricingSection` function definition (the block starting at the `// ─── Pricing ───...` comment through its closing `}`, immediately before the `// ─── Final CTA ───...` comment).

Add to the imports at the top of `app/page.tsx`:
```typescript
import PricingSection from '@/components/marketing/PricingSection'
```

The existing `<PricingSection />` usage inside the page's returned JSX stays exactly where it is — only the import source changes, not the call site.

- [ ] **Step 3: Create `app/pricing/page.tsx`**

```typescript
// Dedicated pricing page — the same PricingSection rendered on the
// homepage, given its own crawlable URL, title, and description so
// direct-intent searches ("rostiro pricing", "how much does rostiro
// cost") and AI-assistant answers have a single-purpose page to point to.

import PublicHeader from '@/components/marketing/PublicHeader'
import PublicFooter from '@/components/marketing/PublicFooter'
import PricingSection from '@/components/marketing/PricingSection'

export const metadata = {
  title: 'Pricing · Rostiro',
  description: 'Free to start: 1 league, Draft Kit, and a daily Pulse. Rostiro Pro is $9.99/mo for unlimited leagues. Launch-window tiers: Founder Season Pass ($59) and Founding 500 ($149 lifetime, capped at 500).',
  alternates: { canonical: 'https://www.rostiro.com/pricing' },
}

export default function PricingPage() {
  return (
    <div style={{ backgroundColor: 'var(--void)', position: 'relative' }}>
      <div className="ambient-ground" aria-hidden="true" />
      <div style={{ position: 'relative', zIndex: 1 }}>
        <PublicHeader />
        <main className="pt-14 md:pt-20">
          <div className="max-w-2xl mx-auto text-center px-4">
            <span className="mono-data text-[11px] tracking-[0.16em] uppercase" style={{ color: 'var(--t3)' }}>
              Pricing
            </span>
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight mt-2" style={{ color: 'var(--t1)' }}>
              Start free. Upgrade when it&apos;s already paying for itself.
            </h1>
          </div>
          <PricingSection />
        </main>
        <PublicFooter />
      </div>
    </div>
  )
}
```

Note: `PricingSection` itself already renders its own `<h2>`/subtext inside a `py-16 md:py-20` section — the `<h1>` block added here is the page-level heading (search engines want exactly one `<h1>` per page), which duplicates similar copy to `PricingSection`'s internal `<h2>`. That's intentional and harmless (an `<h1>` above an `<h2>` restating the same idea in different words is normal on a single-purpose landing page), not a bug to fix.

- [ ] **Step 4: Verify it builds and both pages render real pricing content**

Run: `npx next build 2>&1 | grep -iE "error|pricing"`
Expected: no errors; build output lists `/pricing` as a generated static route.

Then, with a dev server running:
```bash
curl -s http://localhost:3000/pricing | grep -o "Founding 500" | head -1
curl -s http://localhost:3000/ | grep -o "Founding 500" | head -1
```
Expected: both commands print `Founding 500` — confirms the shared component renders identically on both routes.

- [ ] **Step 5: Commit**

```bash
git add components/marketing/PricingSection.tsx app/page.tsx app/pricing/page.tsx
git commit -m "feat(seo): extract PricingSection, add dedicated /pricing page"
```

---

## Task 5: `SoftwareApplication` structured data on `/pricing` and `/features`

**Files:**
- Create: `lib/seoSchema.ts`
- Modify: `app/pricing/page.tsx`
- Modify: `app/features/page.tsx`

**Interfaces:**
- Consumes: `/pricing` page from Task 4.
- Produces: `softwareApplicationSchema` (a plain object, exported from `lib/seoSchema.ts`) — consumed by both pages in this task; also consumed by Task 7's `Organization` schema file (same module, different export).

- [ ] **Step 1: Create `lib/seoSchema.ts` with the `SoftwareApplication` schema**

```typescript
// Structured data (JSON-LD) shared across public marketing pages. Real
// fields only — no fabricated aggregateRating or review counts, matching
// this codebase's existing "no aspirational copy" discipline (see
// app/privacy/page.tsx's own comment on the same standard).

export const softwareApplicationSchema = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'Rostiro',
  applicationCategory: 'SportsApplication',
  operatingSystem: 'Web',
  description: "The operating system for fantasy football: one ranked daily action list across every league you're in, a health score per team, and a product that reshapes itself around the real fantasy calendar.",
  offers: [
    {
      '@type': 'Offer',
      name: 'Free',
      price: '0',
      priceCurrency: 'USD',
    },
    {
      '@type': 'Offer',
      name: 'Rostiro Pro',
      price: '9.99',
      priceCurrency: 'USD',
      priceSpecification: {
        '@type': 'UnitPriceSpecification',
        price: '9.99',
        priceCurrency: 'USD',
        unitCode: 'MON',
      },
    },
    {
      '@type': 'Offer',
      name: '2026 Founder Season Pass',
      price: '59',
      priceCurrency: 'USD',
    },
    {
      '@type': 'Offer',
      name: 'Founding 500',
      price: '149',
      priceCurrency: 'USD',
    },
  ],
}
```

- [ ] **Step 2: Render the schema on `/pricing`**

In `app/pricing/page.tsx`, add the import:
```typescript
import { softwareApplicationSchema } from '@/lib/seoSchema'
```

Add a JSON-LD script tag as the first child inside the outermost `<div>`, immediately before `<div className="ambient-ground" ... />`:
```typescript
<script
  type="application/ld+json"
  dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareApplicationSchema) }}
/>
```

- [ ] **Step 3: Render the same schema on `/features`**

In `app/features/page.tsx`, add the import:
```typescript
import { softwareApplicationSchema } from '@/lib/seoSchema'
```

Add the same script tag as the first child inside `FeaturesPage`'s outermost `<div>`, immediately before its `<div className="ambient-ground" ... />`:
```typescript
<script
  type="application/ld+json"
  dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareApplicationSchema) }}
/>
```

- [ ] **Step 4: Verify the schema renders and is valid JSON**

Run: `npx next build 2>&1 | grep -iE "error|pricing|features"`
Expected: no errors.

Then, with a dev server running:
```bash
curl -s http://localhost:3000/pricing | grep -o 'application/ld+json.*SoftwareApplication' | head -c 200
```
Expected: non-empty output containing `"@type":"SoftwareApplication"`.

Also paste the full `<script type="application/ld+json">` contents from a real page load into Google's Rich Results Test (https://search.google.com/test/rich-results) or the schema.org validator — expected: valid, no errors, real values (no `[PLACEHOLDER]` text).

- [ ] **Step 5: Commit**

```bash
git add lib/seoSchema.ts app/pricing/page.tsx app/features/page.tsx
git commit -m "feat(seo): add SoftwareApplication structured data to /pricing and /features"
```

---

## Task 6: `FAQPage` structured data

**Files:**
- Modify: `components/marketing/FaqAccordion.tsx` (add `answerText` to `FaqItem`)
- Modify: `app/faq/page.tsx` (add `answerText` to all 13 items, render the schema)

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: `FaqItem.answerText: string` — a new required field every `FaqItem` must have going forward (documented here so a future contributor adding an FAQ item knows to fill it in).

- [ ] **Step 1: Add `answerText` to the `FaqItem` interface**

In `components/marketing/FaqAccordion.tsx`, change:
```typescript
export interface FaqItem {
  question: string
  answer: React.ReactNode
}
```
to:
```typescript
export interface FaqItem {
  question: string
  answer: React.ReactNode
  // Plain-text version of `answer`, used only for FAQPage JSON-LD (Task 6
  // of docs/superpowers/plans/2026-07-08-seo-llm-crawlability.md) — schema.org
  // requires plain text, but `answer` is JSX (sometimes with inline links).
  // Keep this in sync manually when editing an answer; FAQ content changes
  // rarely.
  answerText: string
}
```

- [ ] **Step 2: Add `answerText` to all 13 items in `app/faq/page.tsx`**

Add an `answerText` field to each of the 13 `{ question, answer }` objects in the `GROUPS` array, immediately after each item's closing `answer` value. Exact text for each:

1. "Do you replace ESPN, Yahoo, or Sleeper?" →
```typescript
answerText: "No, and that's deliberate. Rostiro doesn't run your league, score your matchups, or host your draft. ESPN, Yahoo, and Sleeper still do all of that. Rostiro watches all three at once and tells you what to do about what it sees. For Yahoo leagues, Rostiro can also set your lineup, claim a waiver, or propose a trade directly, since Yahoo's API supports that. For ESPN and Sleeper, Rostiro deep-links you to the exact right screen on their own site to make the move yourself.",
```

2. "Which platforms and league types are supported?" →
```typescript
answerText: "ESPN, Yahoo, and Sleeper today. Standard, half-PPR, full-PPR, TE premium, and Superflex/2QB formats are all read correctly from your league's real scoring settings. Dynasty and keeper leagues work the same way rosters and waivers already do, though Rostiro doesn't yet have dynasty-specific features like rookie draft pick valuations.",
```

3. "Is this sports betting advice?" →
```typescript
answerText: "No. Rostiro is a decision-support tool for skill-based season-long and weekly fantasy leagues. It doesn't place bets, doesn't set lines, and doesn't make picks against a spread. Nothing in the product is financial, investment, or betting advice, and Rostiro never guarantees a result in your league.",
```

4. "What's the difference between Focused, Balanced, and Savant modes?" →
```typescript
answerText: "It's a density choice, not a skill level. Focused: tell me what to do, five decisions max, the verdict before any reasoning. Balanced: show me the key stuff, the call plus the context that produced it. Savant: give me everything, the full data layer with nothing hidden. Mode changes what every screen in the product shows, not just one page.",
```

5. "Can I switch modes later?" →
```typescript
answerText: "Anytime, from the mode chip in the System Bar or from Settings. Nothing about your account or history changes when you switch.",
```

6. "How secure are my connected league credentials?" →
```typescript
answerText: "Rostiro connects to your leagues read-mostly, and encrypts anything sensitive it has to store. Sleeper: public, read-only API, no credentials stored at all. Yahoo: official OAuth 2.0, Rostiro never sees your password, only a scoped access token encrypted at rest with AES-256-GCM. ESPN: a browser cookie handshake for private leagues, encrypted at rest the same way and used only to read your league's own data.",
```

7. "Can Rostiro make changes to my team without me knowing?" →
```typescript
answerText: "Only where a platform's own API allows it, and only when you tap to confirm. Yahoo is the one platform where Rostiro can submit a lineup, waiver claim, or trade proposal directly, and every one of those is a deliberate action you take, never automatic. ESPN and Sleeper moves always deep-link you to that platform's own site to finish the action yourself.",
```

8. "Can I delete my data?" →
```typescript
answerText: "Yes, anytime, from Settings, then Data & privacy. Export everything Rostiro has on your account, or permanently delete your account and every row tied to it. Deletion takes effect immediately and can't be undone.",
```

9. "Why is Game Day on Rostiro different from checking a normal fantasy app?" →
```typescript
answerText: "Most fantasy apps show every score whether it matters to you or not. Rostiro filters through a portfolio-relevance rule first: it only interrupts you if a live event directly touches your own roster, your opponent's roster, or the waiver wire in a league you're actually in.",
```

10. "Will Rostiro spam me with notifications during a live game?" →
```typescript
answerText: "No, there's a hard rate ceiling regardless of how many games or leagues are live at once, and events are deduplicated across leagues. Push notifications for live events are a Pro feature; every plan still sees the same events inside the app the next time you open it.",
```

11. "Is there a free plan?" →
```typescript
answerText: "Yes, forever: one league, Draft Kit, a daily Pulse, and a limited number of AI-assisted start/sit and trade calls per week. No credit card required to start.",
```

12. "Can I cancel anytime?" →
```typescript
answerText: "Yes. Rostiro Pro is a standard monthly subscription with no lock-in. Cancel from Settings and it stays active through the end of the current billing period.",
```

(Item 13, "What happens to the Founder tiers after launch?", also needs one:)
```typescript
answerText: "The 2026 Founder Season Pass and the Founding 500 lifetime tier are launch-window pricing. Once the window closes, or the first 500 sell out, neither is offered again at that price.",
```

- [ ] **Step 3: Build the `FAQPage` schema and render it**

In `app/faq/page.tsx`, add near the top, after the `GROUPS` array definition:
```typescript
const faqPageSchema = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: GROUPS.flatMap((group) =>
    group.items.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.answerText,
      },
    }))
  ),
}
```

Add the script tag as the first child inside `FaqPage`'s outermost `<div>`, immediately before its `<div className="ambient-ground" ... />`:
```typescript
<script
  type="application/ld+json"
  dangerouslySetInnerHTML={{ __html: JSON.stringify(faqPageSchema) }}
/>
```

- [ ] **Step 4: Verify it builds and the schema is valid**

Run: `npx next build 2>&1 | grep -iE "error|faq"`
Expected: no TypeScript errors (every `FaqItem` now requires `answerText` — a missing one would fail the build, confirming all 13 were added).

Then, with a dev server running:
```bash
curl -s http://localhost:3000/faq | grep -o '"@type":"FAQPage"' 
curl -s http://localhost:3000/faq | grep -o '"@type":"Question"' | wc -l
```
Expected: `"@type":"FAQPage"` printed once, and 13 `"@type":"Question"` matches (one per FAQ item).

Paste the full script contents into the schema.org validator — expected: valid, no errors.

- [ ] **Step 5: Commit**

```bash
git add components/marketing/FaqAccordion.tsx app/faq/page.tsx
git commit -m "feat(seo): add FAQPage structured data"
```

---

## Task 7: `Organization` schema + `llms.txt`

**Files:**
- Modify: `lib/seoSchema.ts` (add `organizationSchema` export)
- Modify: `app/layout.tsx` (render it site-wide)
- Create: `app/llms.txt/route.ts`

**Interfaces:**
- Consumes: `lib/seoSchema.ts` from Task 5 (adds a second export to the same file).
- Produces: nothing consumed by later tasks — this is the final task.

- [ ] **Step 1: Add `organizationSchema` to `lib/seoSchema.ts`**

Append to `lib/seoSchema.ts`:
```typescript
// No `sameAs` — the marketing plan's social handles (X/TikTok/Instagram/
// YouTube) are all [PLACEHOLDER], not yet claimed. Add sameAs once real,
// live accounts exist; fabricating them here would violate this
// codebase's real-fields-only rule for structured data.
export const organizationSchema = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'Rostiro',
  url: 'https://www.rostiro.com',
  logo: 'https://www.rostiro.com/notification-icon.png',
  description: 'The operating system for fantasy football.',
}
```

- [ ] **Step 2: Render it site-wide in the root layout**

In `app/layout.tsx`, add the import:
```typescript
import { organizationSchema } from '@/lib/seoSchema'
```

Add the script tag as the first child inside `<body>`, before the existing `<Script src="https://cdn.onesignal.com/...">`:
```typescript
<script
  type="application/ld+json"
  dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
/>
```

- [ ] **Step 3: Write `app/llms.txt/route.ts`**

```typescript
// Serves /llms.txt — the emerging convention several AI crawlers and
// answer engines check for a structured, plain-text summary of a site.
// A route handler (not a static public/ file) so this stays generated
// from the same real-facts discipline as every other public page, rather
// than a second copy that can drift out of sync.

const LLMS_TXT = `# Rostiro

> The operating system for fantasy football. Rostiro brings every league
> you're in, across ESPN, Yahoo, and Sleeper, into one ranked daily action
> list, with a health score per team and a product that reshapes itself
> around the real fantasy calendar, from draft day through your league's
> real championship.

Free to start (1 league, Draft Kit, daily Pulse). Rostiro Pro is $9.99/mo
for unlimited leagues. Launch-window tiers: 2026 Founder Season Pass ($59)
and Founding 500 ($149 lifetime, capped at 500 members).

Rostiro does not replace ESPN, Yahoo, or Sleeper — those platforms still
run the league, score matchups, and host the draft. Rostiro watches all of
them at once and tells you what to do about what it sees.

## Key pages

- [Features](https://www.rostiro.com/features): what Rostiro actually does
- [Pricing](https://www.rostiro.com/pricing): the 4 plans and what each includes
- [FAQ](https://www.rostiro.com/faq): platform support, security, modes, pricing
`

export async function GET() {
  return new Response(LLMS_TXT, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  })
}
```

- [ ] **Step 4: Verify it builds and all 3 pieces render**

Run: `npx next build 2>&1 | grep -iE "error|layout|llms"`
Expected: no errors; build output lists `/llms.txt` as a generated route.

Then, with a dev server running:
```bash
curl -s http://localhost:3000/ | grep -o '"@type":"Organization"'
curl -s http://localhost:3000/llms.txt
```
Expected: `"@type":"Organization"` printed once from the homepage; the second command prints the real markdown content from Step 3, not empty/error output.

Paste the homepage's `Organization` script contents into the schema.org validator — expected: valid, no errors.

- [ ] **Step 5: Commit**

```bash
git add lib/seoSchema.ts app/layout.tsx "app/llms.txt/route.ts"
git commit -m "feat(seo): add Organization structured data and llms.txt"
```

---

## Self-Review Notes

- **Spec coverage:** all 6 spec sections have a task — sitemap/robots (Task 1), metadata/canonical (Task 2), OG image (Task 3), pricing extraction (Task 4), SoftwareApplication schema (Task 5), FAQPage schema (Task 6), Organization schema + llms.txt (Task 7, combined since both are small site-wide additions sharing the same `lib/seoSchema.ts` file).
- **Placeholder scan:** no TBD/TODO; every `answerText` in Task 6 is fully written out, not summarized.
- **Type consistency:** `PricingSection` (Task 4) is the same name/shape referenced by Task 5's schema comment; `FaqItem.answerText` (Task 6 Step 1) matches every usage in Step 2 and Step 3; `softwareApplicationSchema`/`organizationSchema` names in `lib/seoSchema.ts` match their import sites exactly across Tasks 5 and 7.
- **Out of scope, unchanged from spec:** blog, Google Search Console verification (needs an external verification code first), social `sameAs` links (needs real claimed accounts first), comparison/"how it works" pages — none touched by any task here.
