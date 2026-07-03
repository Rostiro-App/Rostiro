// Feature-flag framework (PRD v5.2, 10.1). DB-backed, not env vars — env
// vars need a Vercel redeploy to change, which fails the actual requirement
// ("toggleable without a deploy"). Cached in memory for a short window so
// this isn't a Supabase round-trip on every request; a flag flip takes
// effect within CACHE_TTL_MS everywhere, which is fine for a kill switch —
// it doesn't need to be instant, it needs to not require a deploy.

import { createAdminClient } from '@/lib/supabase'

const CACHE_TTL_MS = 30_000

let cache: Map<string, boolean> | null = null
let cachedAt = 0

async function loadFlags(): Promise<Map<string, boolean>> {
  const admin = createAdminClient()
  const { data, error } = await admin.from('feature_flags').select('key, enabled')
  if (error) throw new Error(error.message)
  return new Map((data ?? []).map((row) => [row.key, row.enabled]))
}

export async function isFeatureEnabled(key: string): Promise<boolean> {
  const now = Date.now()
  if (!cache || now - cachedAt > CACHE_TTL_MS) {
    cache = await loadFlags()
    cachedAt = now
  }
  // Unknown flag key defaults to disabled — a typo or a flag not yet seeded
  // should never silently enable something.
  return cache.get(key) ?? false
}

// For code paths that already fetched several flags at once (e.g. an admin
// settings page) — one query instead of N.
export async function getAllFlags(): Promise<Record<string, boolean>> {
  const now = Date.now()
  if (!cache || now - cachedAt > CACHE_TTL_MS) {
    cache = await loadFlags()
    cachedAt = now
  }
  return Object.fromEntries(cache)
}
