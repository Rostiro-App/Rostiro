# Marketing Asset Library & Image Posting Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the cockpit's Marketing agent a searchable image library and the ability to generate branded stat/quote/breaking-news cards from real data, then post either kind of image through Postiz with an image-aware Discord approval step.

**Architecture:** A new Supabase Storage bucket + indexing table (`marketing_assets`) that the cockpit reads/writes via a dedicated, narrowly-scoped service-role credential confined to one module. Two new in-process MCP tools (`asset_search`, `generate_stat_card`) exposed to the Marketing agent. Card rendering uses `satori` + `@resvg/resvg-js` (HTML/CSS-like element tree → SVG → PNG, no headless browser, no third-party AI image API). `postiz_create_post` and the Discord approval flow are extended to carry an image through to the final publish.

**Tech Stack:** TypeScript (Node, ESM), `@anthropic-ai/claude-agent-sdk`, `@supabase/supabase-js` (new), `satori` + `@resvg/resvg-js` (new), `zod` (existing), `vitest` (new — this repo has no test runner yet; added here for the pure-logic units only, since the rest of the codebase's convention for I/O-heavy code is a manual "Run/Expected" verification step, not mocked integration tests).

## Global Constraints

- Never fabricate a stat, event, or player depiction that isn't real — carried into every new tool's description and the Marketing agent's system prompt (`Rostiro_Marketing_System_v2.md`'s honesty contract).
- No third-party AI image-generation API. Only the templated `satori`+`resvg` renderer produces images — deliberate, to avoid ever depicting a real player's likeness without rights (`docs/superpowers/specs/2026-07-13-marketing-asset-library-and-image-posting-design.md`).
- Three templates for this phase: `breaking-news`, `stat-highlight`, `quote-card`. More can be added later as new files in `src/marketingAssets/templates/` without changing the tool's interface.
- The asset library's Supabase credential (service-role key) is used in exactly one module (`src/marketingAssets/supabaseAssetsClient.ts`) and only ever touches the `marketing-assets` bucket and `marketing_assets` table — the cockpit's existing read-only Supabase MCP connection to production tables is untouched.
- Every real publish (a real Postiz post) still gates through `permissionGate.ts` in every mode except `readonly` — this plan does not loosen that floor.
- Postiz's real media-upload endpoint shape is unverified until the Hetzner VM is live (matches the existing, already-flagged caveat on `postiz_create_post`/`postiz_get_analytics`) — code lands now, gets confirmed against the real API before any real post.

---

### Task 1: Fix the dangling Postiz MCP registration

The Marketing agent's `mcpServers: ['postiz']` (`src/agents/marketing.ts:21`) references a server named `postiz` by string, which per the SDK's own types (`AgentMcpServerSpec = string | { [name]: config }`) only resolves if the **top-level** `mcpServers` object passed to `query()` has a `postiz` key. `src/mcpServers.ts`'s `buildMcpServers()` currently returns only `{ supabase, n8n }` — `postizMcpServer` (built in `postizTool.ts`) is never registered there. This means every Postiz tool call has been unreachable since it was written, independent of whether the Postiz VM exists. Fix this first since every later task depends on the registration pattern being correct.

**Files:**
- Modify: `src/mcpServers.ts`

**Interfaces:**
- Consumes: `postizMcpServer` (already exported from `src/agents/postizTool.ts`, `McpSdkServerConfigWithInstance`).
- Produces: `buildMcpServers()` now returns an object with a `postiz` key — later tasks add a `marketingAssets` key the same way.

- [ ] **Step 1: Add the import and registration**

Edit `src/mcpServers.ts`, add the import at the top:

```ts
import { postizMcpServer } from './agents/postizTool.js'
```

Add `postiz: postizMcpServer,` to the object `buildMcpServers()` returns, so the full return statement reads:

```ts
  return {
    supabase: {
      type: 'stdio' as const,
      command: 'npx',
      args: [
        '-y',
        '@supabase/mcp-server-supabase@latest',
        '--read-only',
        `--project-ref=${config.supabaseProjectRef}`,
      ],
      env: {
        SUPABASE_ACCESS_TOKEN: config.supabaseAccessToken,
      },
    },
    n8n: {
      type: 'http' as const,
      url: config.n8nMcpUrl,
      headers: {
        Authorization: `Bearer ${config.n8nApiKey}`,
      },
    },
    postiz: postizMcpServer,
  }
```

- [ ] **Step 2: Verify the wiring with a local smoke test (no live Postiz needed)**

Run: `cp .env.example .env` (fill in real Discord/Anthropic/Supabase/n8n values, and set `POSTIZ_API_URL=http://localhost:9999` and `POSTIZ_API_KEY=dummy` — a deliberately unreachable URL, since we're only proving the MCP server connects, not that Postiz responds), then `npm run dev`.

In your Discord `#cockpit` channel, send: `ask the marketing agent to list postiz integrations`

Expected: the response contains a real network error like `Postiz API` fetch failure or `ECONNREFUSED`/`fetch failed` referencing `http://localhost:9999` — **not** an MCP error like "server postiz not found" or "tool postiz_list_integrations not available". A network-level error proves the tool call actually reached `postizFetch`, meaning the MCP wiring is now correct.

- [ ] **Step 3: Commit**

```bash
git add src/mcpServers.ts
git commit -m "fix: register the postiz MCP server at the top level

marketingAgent's mcpServers: ['postiz'] referenced a server name that
was never added to buildMcpServers()'s returned object -- Postiz tools
have been unreachable since they were written. Verified the fix with a
dummy POSTIZ_API_URL: the tool call now fails at the network level
(proving the MCP wiring works) instead of failing with an MCP
server-not-found error."
```

---

### Task 2: Supabase migration — `marketing_assets` table + storage bucket

**Files:**
- Create: `supabase/migration_marketing_assets.sql` (main `Rostiro` repo, alongside the existing flat `migration_*.sql` files)
- Modify: `supabase/grants.sql` is NOT modified — this table intentionally gets no `anon`/`authenticated` grant (it's an agent-only table, never touched by the live app's users), avoiding the exact "new table doesn't inherit the blanket grant" gotcha noted for `cron_heartbeat`.

**Interfaces:**
- Produces: table `public.marketing_assets(id, storage_path, kind, pillar, player_tags, topic, aspect, description, template_id, created_at)` and storage bucket `marketing-assets` (private) — consumed by `supabaseAssetsClient.ts` in Task 3.

- [ ] **Step 1: Write the migration**

```sql
-- Marketing asset library: real screenshots (uploaded manually, same
-- Screen Studio / Simulation Studio workflow as today) and generated stat
-- cards (rendered by the cockpit's Marketing agent), indexed so
-- "find an image of Rostiro Pulse" resolves to something real.
--
-- Deliberately NOT part of the live app's user-facing schema -- no
-- anon/authenticated grant (see grants.sql's comment on this exact gotcha
-- for cron_heartbeat). Only the cockpit's dedicated service-role credential
-- (confined to src/marketingAssets/supabaseAssetsClient.ts) touches this.

create table if not exists public.marketing_assets (
  id uuid primary key default gen_random_uuid(),
  storage_path text not null,
  kind text not null check (kind in ('screenshot', 'generated_card')),
  pillar text,
  player_tags text[] not null default '{}',
  topic text,
  aspect text,
  description text,
  template_id text,
  created_at timestamptz not null default now()
);

create index if not exists marketing_assets_pillar_idx on public.marketing_assets (pillar);
create index if not exists marketing_assets_player_tags_idx on public.marketing_assets using gin (player_tags);

-- Private bucket -- not public, no anon read. The service_role key (used
-- only inside supabaseAssetsClient.ts) bypasses RLS entirely, and signed
-- URLs are minted per-request for anything that needs to be viewed
-- (Discord embeds, Postiz media upload).
insert into storage.buckets (id, name, public)
values ('marketing-assets', 'marketing-assets', false)
on conflict (id) do nothing;

grant select, insert, update, delete on public.marketing_assets to service_role;
```

- [ ] **Step 2: Apply it to the live project**

Use the Supabase MCP tool available in this session: `mcp__plugin_supabase_supabase__apply_migration` with `project_id: zdvjgtyzfmbxhzhjuwbm`, `name: marketing_assets`, and the SQL body above. (Or paste it into the Supabase Dashboard's SQL Editor if applying by hand.)

- [ ] **Step 3: Verify**

Run: `mcp__plugin_supabase_supabase__list_tables` with `project_id: zdvjgtyzfmbxhzhjuwbm` and confirm `marketing_assets` appears. Separately, in the Dashboard → Storage, confirm the `marketing-assets` bucket exists and shows as private.

- [ ] **Step 4: Commit**

```bash
git add supabase/migration_marketing_assets.sql
git commit -m "feat(supabase): marketing_assets table + storage bucket

Indexing table + private bucket for the cockpit's new asset library
tools. No anon/authenticated grant -- agent-only table, service_role
confined to one module (rostiro-cockpit's supabaseAssetsClient.ts)."
```

---

### Task 3: `supabaseAssetsClient.ts` — the one module allowed to touch the bucket/table

**Files:**
- Create: `src/marketingAssets/supabaseAssetsClient.ts`
- Modify: `src/config.ts`
- Modify: `package.json` (add `@supabase/supabase-js`, `vitest`)
- Test: `src/marketingAssets/supabaseAssetsClient.test.ts`

**Interfaces:**
- Consumes: `config.supabaseServiceRoleKey`, a computed `config.supabaseUrl` (both new).
- Produces: `searchAssets(query?, playerTag?): Promise<AssetRow[]>`, `getSignedUrl(storagePath, expiresInSeconds?): Promise<string>`, `uploadGeneratedCard(png: Buffer, filename: string): Promise<string>` (returns storage path), `insertAssetRecord(record): Promise<AssetRow>`, `buildAssetSearchFilter(query?, playerTag?)` (pure helper, exported for testing) — all consumed by `assetTool.ts` (Task 5) and `permissionGate.ts` (Task 7).

- [ ] **Step 1: Add dependencies**

```bash
cd /Users/Lawrence/Documents/rostiro-cockpit
npm install @supabase/supabase-js
npm install -D vitest
```

Add to `package.json`'s `"scripts"`: `"test": "vitest run"`.

- [ ] **Step 2: Extend config.ts**

Add below the existing `postizApiUrl`/`postizApiKey` block in `src/config.ts`:

```ts
  // Direct Supabase Storage + table access for the marketing asset library --
  // separate from the read-only Supabase MCP connection above. Confined to
  // ONE module, src/marketingAssets/supabaseAssetsClient.ts, which only ever
  // touches the marketing-assets bucket and the marketing_assets table --
  // never a production app table. Optional until the asset library is
  // wired up, same pattern as Postiz above (doesn't crash-loop the cockpit
  // if unset; the client throws a clear error at call time instead).
  supabaseUrl: `https://${process.env.SUPABASE_PROJECT_REF ?? ''}.supabase.co`,
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
```

- [ ] **Step 3: Write the failing test for the pure filter-building helper**

```ts
// src/marketingAssets/supabaseAssetsClient.test.ts
import { describe, it, expect } from 'vitest'
import { buildAssetSearchFilter } from './supabaseAssetsClient.js'

describe('buildAssetSearchFilter', () => {
  it('builds an ilike-or clause when a query is given', () => {
    const filter = buildAssetSearchFilter('pulse', undefined)
    expect(filter.orClause).toBe('pillar.ilike.%pulse%,topic.ilike.%pulse%,description.ilike.%pulse%')
    expect(filter.containsClause).toBeNull()
  })

  it('builds a contains clause when a player tag is given', () => {
    const filter = buildAssetSearchFilter(undefined, 'davante-adams')
    expect(filter.orClause).toBeNull()
    expect(filter.containsClause).toEqual(['davante-adams'])
  })

  it('returns both clauses when both inputs are given', () => {
    const filter = buildAssetSearchFilter('pulse', 'davante-adams')
    expect(filter.orClause).toContain('pulse')
    expect(filter.containsClause).toEqual(['davante-adams'])
  })

  it('returns nulls when nothing is given', () => {
    const filter = buildAssetSearchFilter(undefined, undefined)
    expect(filter.orClause).toBeNull()
    expect(filter.containsClause).toBeNull()
  })
})
```

- [ ] **Step 4: Run it to verify it fails**

Run: `npx vitest run src/marketingAssets/supabaseAssetsClient.test.ts`
Expected: FAIL — `Cannot find module './supabaseAssetsClient.js'` (file doesn't exist yet).

- [ ] **Step 5: Write `supabaseAssetsClient.ts`**

```ts
// The one module allowed to touch the marketing-assets bucket and the
// marketing_assets table, using a dedicated service-role credential kept
// separate from the cockpit's read-only Supabase MCP connection to
// production tables (see docs/superpowers/specs/2026-07-13-marketing-asset-
// library-and-image-posting-design.md). Every other module reaches
// Storage/this table only through the functions exported here.

import { createClient } from '@supabase/supabase-js'
import { config } from '../config.js'

export type AssetKind = 'screenshot' | 'generated_card'

export type AssetRow = {
  id: string
  storage_path: string
  kind: AssetKind
  pillar: string | null
  player_tags: string[]
  topic: string | null
  aspect: string | null
  description: string | null
  template_id: string | null
  created_at: string
}

function requireAssetsClient() {
  if (!config.supabaseServiceRoleKey) {
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY is not set -- the asset library needs it to read/write the marketing-assets bucket and table (Dashboard -> Settings -> API -> service_role key). See README.md Setup.'
    )
  }
  return createClient(config.supabaseUrl, config.supabaseServiceRoleKey)
}

// Pure, network-free -- exported for unit testing the filter-building logic
// without hitting Supabase.
export function buildAssetSearchFilter(query?: string, playerTag?: string) {
  return {
    orClause: query ? `pillar.ilike.%${query}%,topic.ilike.%${query}%,description.ilike.%${query}%` : null,
    containsClause: playerTag ? [playerTag] : null,
  }
}

export async function searchAssets(query?: string, playerTag?: string): Promise<AssetRow[]> {
  const client = requireAssetsClient()
  const filter = buildAssetSearchFilter(query, playerTag)
  let builder = client.from('marketing_assets').select('*').order('created_at', { ascending: false }).limit(10)
  if (filter.orClause) builder = builder.or(filter.orClause)
  if (filter.containsClause) builder = builder.contains('player_tags', filter.containsClause)
  const { data, error } = await builder
  if (error) throw new Error(`marketing_assets search failed: ${error.message}`)
  return data as AssetRow[]
}

export async function getSignedUrl(storagePath: string, expiresInSeconds = 3600): Promise<string> {
  const client = requireAssetsClient()
  const { data, error } = await client.storage.from('marketing-assets').createSignedUrl(storagePath, expiresInSeconds)
  if (error || !data) throw new Error(`Could not sign URL for ${storagePath}: ${error?.message ?? 'unknown error'}`)
  return data.signedUrl
}

export async function uploadGeneratedCard(png: Buffer, filename: string): Promise<string> {
  const client = requireAssetsClient()
  const storagePath = `generated/${filename}`
  const { error } = await client.storage
    .from('marketing-assets')
    .upload(storagePath, png, { contentType: 'image/png', upsert: false })
  if (error) throw new Error(`Upload failed for ${storagePath}: ${error.message}`)
  return storagePath
}

export async function insertAssetRecord(record: {
  storagePath: string
  kind: AssetKind
  pillar?: string
  playerTags?: string[]
  topic?: string
  description?: string
  templateId?: string
  aspect?: string
}): Promise<AssetRow> {
  const client = requireAssetsClient()
  const { data, error } = await client
    .from('marketing_assets')
    .insert({
      storage_path: record.storagePath,
      kind: record.kind,
      pillar: record.pillar ?? null,
      player_tags: record.playerTags ?? [],
      topic: record.topic ?? null,
      description: record.description ?? null,
      template_id: record.templateId ?? null,
      aspect: record.aspect ?? null,
    })
    .select()
    .single()
  if (error) throw new Error(`Insert into marketing_assets failed: ${error.message}`)
  return data as AssetRow
}
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `npx vitest run src/marketingAssets/supabaseAssetsClient.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json src/config.ts src/marketingAssets/supabaseAssetsClient.ts src/marketingAssets/supabaseAssetsClient.test.ts
git commit -m "feat: supabaseAssetsClient -- the one module touching marketing-assets

Dedicated service-role credential confined to this module only. Pure
buildAssetSearchFilter logic is unit tested; the network-calling
functions (search/upload/insert/sign) are exercised end-to-end in
Task 5's manual verification once the DB migration is live."
```

---

### Task 4: Card templates (`breaking-news`, `stat-highlight`, `quote-card`) + renderer

**Files:**
- Create: `src/marketingAssets/templates/breakingNews.ts`
- Create: `src/marketingAssets/templates/statHighlight.ts`
- Create: `src/marketingAssets/templates/quoteCard.ts`
- Create: `src/marketingAssets/templates/index.ts`
- Create: `src/marketingAssets/templates/templates.test.ts`
- Create: `src/marketingAssets/renderCard.ts`
- Create: `src/marketingAssets/fonts/` — add `Inter-Regular.ttf` and `Inter-Bold.ttf` (download from Google Fonts' Inter, OFL-licensed)

**Interfaces:**
- Consumes: nothing external.
- Produces: `templates: Record<TemplateId, { schema: ZodSchema, render: (data) => SatoriNode }>`, `type TemplateId`, `renderCard(templateId: TemplateId, rawData: Record<string,string>): Promise<Buffer>` — consumed by `assetTool.ts` in Task 5.

- [ ] **Step 1: Download the fonts**

```bash
mkdir -p src/marketingAssets/fonts
curl -L -o src/marketingAssets/fonts/Inter-Regular.ttf "https://github.com/rsms/inter/raw/master/docs/font-files/Inter-Regular.ttf"
curl -L -o src/marketingAssets/fonts/Inter-Bold.ttf "https://github.com/rsms/inter/raw/master/docs/font-files/Inter-Bold.ttf"
```

- [ ] **Step 2: Write the failing schema tests**

```ts
// src/marketingAssets/templates/templates.test.ts
import { describe, it, expect } from 'vitest'
import { templates } from './index.js'

describe('template schemas', () => {
  it('breaking-news accepts a valid payload', () => {
    const result = templates['breaking-news'].schema.safeParse({
      headline: 'Starter ruled out 90 minutes before kickoff',
      source: 'ESPN',
      timestamp: '2026-09-14T17:00:00Z',
    })
    expect(result.success).toBe(true)
  })

  it('breaking-news rejects a missing field', () => {
    const result = templates['breaking-news'].schema.safeParse({ headline: 'x', source: 'ESPN' })
    expect(result.success).toBe(false)
  })

  it('stat-highlight accepts a valid payload', () => {
    const result = templates['stat-highlight'].schema.safeParse({
      statValue: '4',
      statLabel: 'leagues rostering this player',
      context: 'Every one of them just moved.',
    })
    expect(result.success).toBe(true)
  })

  it('quote-card accepts a valid payload', () => {
    const result = templates['quote-card'].schema.safeParse({
      quote: 'Run every league. One place.',
      attribution: '@rostiro',
    })
    expect(result.success).toBe(true)
  })

  it('quote-card rejects an empty quote', () => {
    const result = templates['quote-card'].schema.safeParse({ quote: '', attribution: '@rostiro' })
    expect(result.success).toBe(false)
  })
})
```

- [ ] **Step 3: Run to verify it fails**

Run: `npx vitest run src/marketingAssets/templates/templates.test.ts`
Expected: FAIL — `Cannot find module './index.js'`.

- [ ] **Step 4: Write `breakingNews.ts`**

```ts
import { z } from 'zod'

export const breakingNewsSchema = z.object({
  headline: z.string().min(1).max(140),
  source: z.string().min(1).max(60),
  timestamp: z.string().min(1),
})

export type BreakingNewsData = z.infer<typeof breakingNewsSchema>

export function renderBreakingNews(data: BreakingNewsData) {
  return {
    type: 'div',
    props: {
      style: {
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        width: '1080px',
        height: '1080px',
        padding: '80px',
        backgroundColor: '#0B0F19',
        color: '#FFFFFF',
        fontFamily: 'Inter',
      },
      children: [
        {
          type: 'div',
          props: {
            style: { fontSize: 36, fontWeight: 700, color: '#FF4D4D', letterSpacing: 2 },
            children: 'BREAKING',
          },
        },
        {
          type: 'div',
          props: {
            style: { fontSize: 72, fontWeight: 700, lineHeight: 1.15, marginTop: 40 },
            children: data.headline,
          },
        },
        {
          type: 'div',
          props: {
            style: { display: 'flex', justifyContent: 'space-between', fontSize: 28, color: '#9AA3B2' },
            children: [
              { type: 'span', props: { children: data.source } },
              { type: 'span', props: { children: data.timestamp } },
            ],
          },
        },
      ],
    },
  }
}
```

- [ ] **Step 5: Write `statHighlight.ts`**

```ts
import { z } from 'zod'

export const statHighlightSchema = z.object({
  statValue: z.string().min(1).max(20),
  statLabel: z.string().min(1).max(80),
  context: z.string().min(1).max(140),
})

export type StatHighlightData = z.infer<typeof statHighlightSchema>

export function renderStatHighlight(data: StatHighlightData) {
  return {
    type: 'div',
    props: {
      style: {
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        width: '1080px',
        height: '1080px',
        padding: '80px',
        backgroundColor: '#0B0F19',
        color: '#FFFFFF',
        fontFamily: 'Inter',
        textAlign: 'center',
      },
      children: [
        {
          type: 'div',
          props: {
            style: { fontSize: 220, fontWeight: 700, color: '#4DE8C2', lineHeight: 1 },
            children: data.statValue,
          },
        },
        {
          type: 'div',
          props: {
            style: { fontSize: 40, fontWeight: 700, marginTop: 24 },
            children: data.statLabel,
          },
        },
        {
          type: 'div',
          props: {
            style: { fontSize: 28, color: '#9AA3B2', marginTop: 32 },
            children: data.context,
          },
        },
      ],
    },
  }
}
```

- [ ] **Step 6: Write `quoteCard.ts`**

```ts
import { z } from 'zod'

export const quoteCardSchema = z.object({
  quote: z.string().min(1).max(220),
  attribution: z.string().min(1).max(60),
})

export type QuoteCardData = z.infer<typeof quoteCardSchema>

export function renderQuoteCard(data: QuoteCardData) {
  return {
    type: 'div',
    props: {
      style: {
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        width: '1080px',
        height: '1080px',
        padding: '100px',
        backgroundColor: '#FFFFFF',
        color: '#0B0F19',
        fontFamily: 'Inter',
      },
      children: [
        {
          type: 'div',
          props: {
            style: { fontSize: 56, fontWeight: 700, lineHeight: 1.25 },
            children: `"${data.quote}"`,
          },
        },
        {
          type: 'div',
          props: {
            style: { fontSize: 28, color: '#6B7280', marginTop: 48 },
            children: `— ${data.attribution}`,
          },
        },
      ],
    },
  }
}
```

- [ ] **Step 7: Write `index.ts`**

```ts
import { breakingNewsSchema, renderBreakingNews } from './breakingNews.js'
import { statHighlightSchema, renderStatHighlight } from './statHighlight.js'
import { quoteCardSchema, renderQuoteCard } from './quoteCard.js'

export const templates = {
  'breaking-news': { schema: breakingNewsSchema, render: renderBreakingNews },
  'stat-highlight': { schema: statHighlightSchema, render: renderStatHighlight },
  'quote-card': { schema: quoteCardSchema, render: renderQuoteCard },
} as const

export type TemplateId = keyof typeof templates
```

- [ ] **Step 8: Run tests to verify they pass**

Run: `npx vitest run src/marketingAssets/templates/templates.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 9: Add rendering dependencies**

```bash
npm install satori @resvg/resvg-js
```

- [ ] **Step 10: Write `renderCard.ts`**

```ts
// HTML/CSS-like template -> PNG, with no headless browser and no
// third-party AI image API (see the design doc's rationale: a generative
// model risks depicting a real player's likeness without rights; this
// renderer can only ever draw the fixed brand templates with real data).

import satori from 'satori'
import { Resvg } from '@resvg/resvg-js'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { templates, type TemplateId } from './templates/index.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const interRegular = readFileSync(join(__dirname, 'fonts/Inter-Regular.ttf'))
const interBold = readFileSync(join(__dirname, 'fonts/Inter-Bold.ttf'))

export async function renderCard(templateId: TemplateId, rawData: Record<string, string>): Promise<Buffer> {
  const template = templates[templateId]
  if (!template) {
    throw new Error(`Unknown templateId "${templateId}". Valid options: ${Object.keys(templates).join(', ')}`)
  }
  const parsed = template.schema.safeParse(rawData)
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')
    throw new Error(`Data does not match "${templateId}" schema: ${issues}`)
  }
  const element = (template.render as (d: typeof parsed.data) => unknown)(parsed.data)
  const svg = await satori(element as never, {
    width: 1080,
    height: 1080,
    fonts: [
      { name: 'Inter', data: interRegular, weight: 400, style: 'normal' },
      { name: 'Inter', data: interBold, weight: 700, style: 'normal' },
    ],
  })
  const resvg = new Resvg(svg)
  return resvg.render().asPng()
}
```

- [ ] **Step 11: Manual visual verification (one PNG per template)**

Run, from the `rostiro-cockpit` directory:

```bash
npx tsx -e "
import { renderCard } from './src/marketingAssets/renderCard.js'
import { writeFileSync } from 'node:fs'
const cases = [
  ['breaking-news', { headline: 'TEST: starter ruled out 90 min before kickoff', source: 'ESPN', timestamp: '2026-09-14T17:00:00Z' }],
  ['stat-highlight', { statValue: '4', statLabel: 'leagues rostering this player', context: 'TEST: every one of them just moved.' }],
  ['quote-card', { quote: 'TEST: run every league, one place.', attribution: '@rostiro' }],
] as const
for (const [id, data] of cases) {
  const png = await renderCard(id, data as Record<string, string>)
  writeFileSync(\`/tmp/\${id}.png\`, png)
  console.log(\`wrote /tmp/\${id}.png\`)
}
"
```

Expected: three files written with no errors. Open each in Preview/Finder and confirm it visually matches the intended layout (dark breaking-news card, teal stat-highlight card, white quote card), correct font (Inter, not a fallback serif), and no clipped text.

- [ ] **Step 12: Commit**

```bash
git add src/marketingAssets/templates src/marketingAssets/renderCard.ts src/marketingAssets/fonts package.json package-lock.json
git commit -m "feat: three card templates + satori/resvg renderer

breaking-news, stat-highlight, quote-card -- each with its own zod
schema so generate_stat_card (Task 5) can reject data that doesn't
match the chosen template rather than rendering garbage. No AI
image-gen API; deterministic HTML/CSS-style templates only."
```

---

### Task 5: `assetTool.ts` — the two new MCP tools, wired to the Marketing agent

**Files:**
- Create: `src/marketingAssets/assetTool.ts`
- Modify: `src/mcpServers.ts`
- Modify: `src/agents/marketing.ts`

**Interfaces:**
- Consumes: `searchAssets`, `getSignedUrl`, `uploadGeneratedCard`, `insertAssetRecord` (Task 3), `renderCard`, `templates`, `TemplateId` (Task 4).
- Produces: `marketingAssetsMcpServer` (registered under the `marketingAssets` key, same pattern as Task 1's `postiz` fix) — consumed by `mcpServers.ts` and referenced by name in `marketing.ts`.

- [ ] **Step 1: Write `assetTool.ts`**

```ts
import { z } from 'zod'
import { tool, createSdkMcpServer } from '@anthropic-ai/claude-agent-sdk'
import { searchAssets, getSignedUrl, uploadGeneratedCard, insertAssetRecord } from './supabaseAssetsClient.js'
import { renderCard } from './renderCard.js'
import { templates, type TemplateId } from './templates/index.js'

const templateIds = Object.keys(templates) as [TemplateId, ...TemplateId[]]

const assetSearch = tool(
  'asset_search',
  'Search the marketing asset library (real screenshots and previously generated cards) by pillar, topic, or player tag. Returns matches with a temporary signed URL to view each image. Use this BEFORE generate_stat_card -- prefer a real existing screenshot when one fits.',
  {
    query: z.string().optional().describe('Free-text match against pillar/topic/description, e.g. "pulse" or "cross-league"'),
    playerTag: z.string().optional().describe('Exact player tag to filter by, e.g. "davante-adams"'),
  },
  async (args) => {
    const rows = await searchAssets(args.query, args.playerTag)
    const withUrls = await Promise.all(
      rows.map(async (row) => ({ ...row, signedUrl: await getSignedUrl(row.storage_path) }))
    )
    return { content: [{ type: 'text', text: JSON.stringify(withUrls, null, 2) }] }
  }
)

const generateStatCard = tool(
  'generate_stat_card',
  `Generate a branded image from real data using one of the fixed templates (${templateIds.join(', ')}). Only call this after asset_search finds nothing suitable. Never call this with fabricated data -- every field must come from a real source (Rostiro's own data, or the operator directly).`,
  {
    templateId: z.enum(templateIds),
    data: z.record(z.string(), z.string()).describe("Field values matching the chosen template's schema"),
  },
  async (args) => {
    const png = await renderCard(args.templateId, args.data)
    const filename = `${args.templateId}-${Date.now()}.png`
    const storagePath = await uploadGeneratedCard(png, filename)
    const record = await insertAssetRecord({
      storagePath,
      kind: 'generated_card',
      templateId: args.templateId,
      description: Object.values(args.data).join(' | '),
    })
    const signedUrl = await getSignedUrl(storagePath)
    return { content: [{ type: 'text', text: JSON.stringify({ ...record, signedUrl }, null, 2) }] }
  }
)

export const marketingAssetsMcpServer = createSdkMcpServer({
  name: 'marketingAssets',
  tools: [assetSearch, generateStatCard],
})
```

- [ ] **Step 2: Register it in `mcpServers.ts`**

Add the import:

```ts
import { marketingAssetsMcpServer } from './marketingAssets/assetTool.js'
```

Add `marketingAssets: marketingAssetsMcpServer,` to the returned object, alongside the `postiz` key added in Task 1.

- [ ] **Step 3: Wire it into the Marketing agent**

Edit `src/agents/marketing.ts`: change `mcpServers: ['postiz']` to `mcpServers: ['postiz', 'marketingAssets']`, and extend the prompt's `WHAT YOU CAN DO` section:

```ts
WHAT YOU CAN DO:
- Draft a post (any channel) for the operator to review.
- Use asset_search to find a real, already-captured screenshot before generating anything new -- prefer a real image over a generated card when one genuinely fits the moment.
- Use generate_stat_card (templates: breaking-news, stat-highlight, quote-card) when no real screenshot fits, filling it only with real data (Rostiro's own pulse_items/news_items, or data the operator gives you directly) -- never an invented stat or event.
- Use the postiz_* tools to check connected integrations, pull real analytics, and (only after explicit approval of the exact text AND image) schedule or publish.
- Use WebFetch/WebSearch for real-world research (a headline, a trend, a competitor) -- never fabricate a source.
```

- [ ] **Step 4: Manual verification**

Run: `npm run dev` locally (env vars set as in Task 1's verification, service-role key now also set from Task 3).

In `#cockpit`: `ask the marketing agent to search assets for "pulse"`

Expected: a reply showing either an empty result (correct, since nothing's been uploaded yet) or real rows if you manually uploaded a test image to the bucket and inserted a row first. No error about the tool being unavailable.

Then: `ask the marketing agent to generate a stat-highlight card with statValue 4, statLabel "leagues rostering this player", context "TEST card from the cockpit"`

Expected: a reply containing a `signedUrl` — open it in a browser and confirm it shows the rendered card.

- [ ] **Step 5: Commit**

```bash
git add src/marketingAssets/assetTool.ts src/mcpServers.ts src/agents/marketing.ts
git commit -m "feat: wire asset_search + generate_stat_card into the marketing agent

Registered marketingAssetsMcpServer the same correct way Task 1 fixed
for postiz (top-level buildMcpServers() key, referenced by name in the
agent's mcpServers array). Verified end-to-end via Discord: search
returns real rows, generate_stat_card returns a viewable signed URL."
```

---

### Task 6: Media support in `postiz_create_post`

**Files:**
- Modify: `src/agents/postizTool.ts`

**Interfaces:**
- Consumes: `getSignedUrl` (Task 3).
- Produces: `postiz_create_post` now accepts an optional `mediaAssetId`, resolved to a signed URL before the Postiz API call. `permissionGate.ts` (Task 7) reads the same `mediaAssetId` off the tool's raw `input` to build the approval preview.

- [ ] **Step 1: Extend the tool**

Edit `src/agents/postizTool.ts`: add the import `import { getSignedUrl } from '../marketingAssets/supabaseAssetsClient.js'`, then replace the `createPost` definition with:

```ts
// ⚠️ UNVERIFIED REQUEST BODY SHAPE (media portion). The text-only body shape
// below carries the same pre-existing caveat as before Task 6; the `image`
// field added here is a best-effort guess at Postiz's real media-attachment
// shape and MUST be confirmed against the live instance's own docs
// (docs.postiz.com/public-api/posts, or whatever the running instance's own
// docs page shows) before trusting it in a real approval flow.
const createPost = tool(
  'postiz_create_post',
  'Create (schedule, or post now) a social post via Postiz, across one or more connected integrations, optionally with an image. This is a REAL publish to REAL social accounts -- only call this after the operator has explicitly approved the exact content AND image.',
  {
    content: z.string().describe('The post text/caption'),
    integrationIds: z.array(z.string()).describe('Which connected integration IDs to post to (see postiz_list_integrations)'),
    type: z.enum(['now', 'schedule']).describe('Post immediately, or schedule for later'),
    scheduleDate: z.string().optional().describe('ISO 8601 datetime, required if type is "schedule"'),
    mediaAssetId: z.string().optional().describe('A marketing_assets.id (from asset_search or generate_stat_card) to attach as the post image'),
  },
  async (args) => {
    const imageUrl = args.mediaAssetId ? await getSignedUrl(args.mediaAssetId) : undefined
    const body = await postizFetch('/posts', {
      method: 'POST',
      body: JSON.stringify({
        type: args.type,
        date: args.scheduleDate,
        content: [{ integration: { id: undefined }, value: args.content, image: imageUrl }],
        integrations: args.integrationIds,
      }),
    })
    return { content: [{ type: 'text', text: body }] }
  }
)
```

Note: `getSignedUrl` takes a **storage path**, but `mediaAssetId` here is described as a `marketing_assets.id` (the row's UUID, easier for the agent to reference than a raw path). Since `getSignedUrl` needs the storage path, add a small lookup: change the call to first fetch the row. Update `supabaseAssetsClient.ts` (Task 3's file) by adding one more exported function:

```ts
export async function getAssetById(id: string): Promise<AssetRow> {
  const client = requireAssetsClient()
  const { data, error } = await client.from('marketing_assets').select('*').eq('id', id).single()
  if (error || !data) throw new Error(`No marketing_assets row for id ${id}: ${error?.message ?? 'not found'}`)
  return data as AssetRow
}
```

Then in `postizTool.ts`, import `getAssetById` alongside `getSignedUrl`, and change the handler's first line to:

```ts
    const imageUrl = args.mediaAssetId
      ? await getSignedUrl((await getAssetById(args.mediaAssetId)).storage_path)
      : undefined
```

- [ ] **Step 2: Add the unit test for `getAssetById`'s error path**

```ts
// append to src/marketingAssets/supabaseAssetsClient.test.ts
import { getAssetById } from './supabaseAssetsClient.js'

describe('getAssetById', () => {
  it('throws a clear error when the service role key is unset', async () => {
    const original = process.env.SUPABASE_SERVICE_ROLE_KEY
    delete process.env.SUPABASE_SERVICE_ROLE_KEY
    await expect(getAssetById('00000000-0000-0000-0000-000000000000')).rejects.toThrow(
      /SUPABASE_SERVICE_ROLE_KEY is not set/
    )
    if (original) process.env.SUPABASE_SERVICE_ROLE_KEY = original
  })
})
```

- [ ] **Step 3: Run it**

Run: `npx vitest run src/marketingAssets/supabaseAssetsClient.test.ts`
Expected: PASS (5 tests total now).

- [ ] **Step 4: Commit**

```bash
git add src/agents/postizTool.ts src/marketingAssets/supabaseAssetsClient.ts src/marketingAssets/supabaseAssetsClient.test.ts
git commit -m "feat: postiz_create_post accepts an optional mediaAssetId

Resolves a marketing_assets row to a signed URL and attaches it to the
Postiz post body. Media-attachment request shape is flagged unverified
until confirmed against Postiz's real docs, matching the existing
caveat already on this file's text-only path."
```

---

### Task 7: Image-aware Discord approval

**Files:**
- Modify: `src/permissionGate.ts`

**Interfaces:**
- Consumes: `getAssetById`, `getSignedUrl` (Task 3/6).
- Produces: `askForApproval` now sends an embed with the image when `input.mediaAssetId` is present. No change to `buildCanUseTool`'s exported signature — `discordBot.ts` needs no changes.

- [ ] **Step 1: Extend `askForApproval`**

In `src/permissionGate.ts`, add the import:

```ts
import { getAssetById, getSignedUrl } from './marketingAssets/supabaseAssetsClient.js'
```

Replace `askForApproval`'s body:

```ts
async function askForApproval(
  cockpitChannel: TextChannel,
  toolName: string,
  input: Record<string, unknown>,
  toolUseID: string,
  label: string
): Promise<PermissionResult> {
  const preview = JSON.stringify(input, null, 2).slice(0, 1500)
  const mediaAssetId = typeof input.mediaAssetId === 'string' ? input.mediaAssetId : undefined

  let imageUrl: string | undefined
  if (mediaAssetId) {
    try {
      const asset = await getAssetById(mediaAssetId)
      imageUrl = await getSignedUrl(asset.storage_path)
    } catch (err) {
      // Don't silently drop the image requirement -- if it can't be
      // resolved, the operator needs to know before approving a post that
      // was supposed to carry an image.
      await cockpitChannel.send(
        `⚠️ Could not load the image for this proposal (\`${mediaAssetId}\`): ${err instanceof Error ? err.message : String(err)}`
      )
    }
  }

  await cockpitChannel.send({
    content: `⏸️ **${label}** — \`${toolName}\`\n\`\`\`json\n${preview}\n\`\`\`\nReply \`go ${toolUseID}\` to approve, or \`cancel ${toolUseID}\` to reject.`,
    embeds: imageUrl ? [{ image: { url: imageUrl } }] : undefined,
  })

  const approved = await new Promise<boolean>((resolve) => {
    pendingApprovals.set(toolUseID, resolve)
  })
  return approved ? allow(input) : deny('Operator declined')
}
```

- [ ] **Step 2: Manual verification**

Run: `npm run dev` locally (`!mode propose`, the default). In `#cockpit`:

`ask the marketing agent to generate a stat-highlight card (statValue 4, statLabel "leagues rostering this player", context "TEST") and propose posting it — do not actually publish`

Expected: a Discord message appears with the JSON preview **and** the actual rendered image visible as an embed, plus the `go`/`cancel` instructions. Reply `cancel <id>` and confirm the response is `❌ Cancelled.` and no Postiz call was made (check for the absence of any `postizFetch` network attempt in the console log).

- [ ] **Step 3: Commit**

```bash
git add src/permissionGate.ts
git commit -m "feat: attach the real image to the Discord approval message

When a proposed postiz_create_post carries a mediaAssetId, the
operator now sees the actual image in the approval embed, not just a
JSON blob referencing an id. Verified end-to-end with cancel (no
publish occurs) before trusting go on a real post."
```

---

### Task 8: Documentation — capabilities doc + README updates

**Files:**
- Create: `docs/marketing-agent-capabilities.md` (in `rostiro-cockpit`)
- Modify: `README.md` (in `rostiro-cockpit`) — "The team" section and "Setup" list

**Interfaces:** None — documentation only.

- [ ] **Step 1: Write `docs/marketing-agent-capabilities.md`**

```markdown
# Marketing agent capabilities

What the cockpit's Marketing sub-agent (`src/agents/marketing.ts`) can actually do, kept up to date as the tool changes.

## Tools it has
- `WebFetch`, `WebSearch` -- real-world research (headlines, trends, competitors).
- `postiz_list_integrations` -- which social accounts are connected right now.
- `postiz_get_analytics` -- real performance numbers per channel.
- `postiz_create_post` -- schedule or publish, text and/or an image, to one or more connected channels. Always gated by `permissionGate.ts` -- a real publish requires an explicit `go` in every mode except `readonly`.
- `asset_search` -- find a real, already-captured screenshot in the `marketing_assets` library by pillar/topic/player tag.
- `generate_stat_card` -- render a branded image from real data using one of three templates: `breaking-news`, `stat-highlight`, `quote-card`. Never uses a third-party AI image model -- deterministic templates only, so it can never fabricate a player's likeness.

## What it does NOT do
- No Bash/Write/Edit -- cannot touch Rostiro's app code.
- Cannot drive the Simulation Studio itself to capture a fresh screenshot on demand (deferred: see the Week 2-3 follow-on design for headless Studio capture). It can only find screenshots you've already uploaded.
- Never invents a stat, metric, event, or player depiction that isn't real -- if `asset_search` finds nothing and there's no real data for a card, it says so and asks rather than guessing.

## The Davante-Adams-touchdown example, end to end
1. You ask the cockpit in `#cockpit`.
2. It delegates to the Marketing agent.
3. Agent calls `asset_search` for a matching real Pulse screenshot; if none fits, it calls `generate_stat_card` with real data (from Rostiro's own Supabase tables via its read-only connection, or whatever you tell it directly).
4. Agent drafts the caption in brand voice.
5. You get a Discord message with the actual image, the caption, the target platform(s), and the schedule time, plus `go`/`cancel`.
6. `go <id>` -> `postiz_create_post` actually publishes.

## Known gaps (tracked, not yet built)
- Headless/on-demand Studio screenshot capture -- Week 2-3 follow-on.
- Video attachment (Reels/TikTok/Shorts clips) -- this phase is images only.
- Multi-image carousels / Stories-specific formatting.
```

- [ ] **Step 2: Update `README.md`'s "The team" section**

Add a sentence after the existing Marketing agent paragraph:

```markdown
As of the asset-library build, the Marketing agent can also search a
tagged image library (`marketing_assets` in Supabase) and generate
branded stat/quote/breaking-news cards from real data -- see
`docs/marketing-agent-capabilities.md` for the full, kept-current
capability list.
```

- [ ] **Step 3: Add the new setup step to `README.md`'s "Setup" numbered list**

Insert after the existing Postiz step (step 8):

```markdown
9. **Supabase service-role key** (for the marketing asset library) --
   Dashboard -> Settings -> API -> `service_role` key (secret, not the
   `anon` key). Used only by `src/marketingAssets/supabaseAssetsClient.ts`,
   confined to the `marketing-assets` bucket and `marketing_assets` table --
   never a production app table (see `docs/security-posture.md`).
```

And add to the `fly secrets set` command block:

```bash
  SUPABASE_SERVICE_ROLE_KEY=...
```

- [ ] **Step 4: Commit**

```bash
git add docs/marketing-agent-capabilities.md README.md
git commit -m "docs: marketing agent capabilities doc + asset-library setup steps"
```

---

## Self-review notes (fixed inline before handoff)

- Confirmed every task's file paths match the real repo layout read at plan-writing time (`src/agents/`, `src/config.ts`, `src/mcpServers.ts`, `src/permissionGate.ts`).
- Confirmed the MCP server registration pattern (`AgentMcpServerSpec = string | { [name]: config }`, `McpSdkServerConfigWithInstance` only valid at the top-level `query()` call) against the installed SDK's actual `.d.ts` files, not assumed -- this is what surfaced the Task 1 bugfix.
- `getAssetById` is introduced in Task 6 but used by both Task 6 (`postizTool.ts`) and Task 7 (`permissionGate.ts`) -- defined once in Task 3's file, no duplication.
- Zod `z.record(z.string(), z.string())` two-argument form used throughout, matching the installed `zod@^4` (v3's single-argument form would fail at compile time).
