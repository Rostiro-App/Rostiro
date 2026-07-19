// P3.5-4C correction: static well-formedness checks for the proposed global
// push-subscription identity migration + its read-only verifier. We can't run
// SQL against production here, so this asserts the migration's structure (abort
// precondition, global unique index, preserved composite target) and that the
// verifier reads the ACTUAL index definition from the catalog (regression test
// 14) rather than assuming it.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

// Read from the repo root (vitest runs with cwd at the project root); a
// file:// URL from import.meta isn't available under the vite transform.
const migration = readFileSync(resolve(process.cwd(), 'supabase/migration_push_subscription_global_identity.sql'), 'utf8')
const verifier = readFileSync(resolve(process.cwd(), 'supabase/verify_push_subscription_global_identity.sql'), 'utf8')
const launchSecurity = readFileSync(resolve(process.cwd(), 'supabase/migration_launch_security.sql'), 'utf8')

describe('migration_push_subscription_global_identity', () => {
  it('aborts if duplicate onesignal_player_id values already exist', () => {
    expect(migration).toMatch(/having count\(\*\) > 1/i)
    expect(migration).toMatch(/raise exception/i)
  })

  it('creates a global unique index on onesignal_player_id (idempotent)', () => {
    expect(migration).toMatch(
      /create unique index if not exists\s+push_subscriptions_onesignal_player_id_global_key\s+on public\.push_subscriptions \(onesignal_player_id\)/i
    )
  })

  it('preserves the composite constraint as the upsert conflict target', () => {
    // The migration must not drop unique(user_id, onesignal_player_id) — the
    // route's upsert conflict target depends on it.
    expect(migration).not.toMatch(/drop\s+constraint/i)
    expect(migration).not.toMatch(/drop\s+index[^;]*user_id/i)
  })

  it('is wrapped in a transaction', () => {
    expect(migration).toMatch(/^begin;/im)
    expect(migration).toMatch(/^commit;/im)
  })
})

describe('verify_push_subscription_global_identity (read-only)', () => {
  it('checks for zero duplicate subscription ids', () => {
    expect(verifier).toMatch(/no_duplicate_subscription_ids/)
    expect(verifier).toMatch(/having count\(\*\) > 1/i)
  })

  it('checks the ACTUAL global unique index definition via the catalog', () => {
    expect(verifier).toMatch(/pg_indexes/i)
    expect(verifier).toMatch(/push_subscriptions_onesignal_player_id_global_key/)
    expect(verifier).toMatch(/CREATE UNIQUE INDEX/i)
    expect(verifier).toMatch(/\(onesignal_player_id\)/i)
  })

  it('checks that no rows have empty subscription ids', () => {
    expect(verifier).toMatch(/no_empty_subscription_ids/)
    expect(verifier).toMatch(/is null/i)
  })

  it('contains only read-only statements (every statement is a SELECT)', () => {
    // Strip comment lines, then confirm each ;-terminated statement starts with
    // SELECT — so write keywords appearing inside string literals (e.g. the
    // catalog check's 'CREATE UNIQUE INDEX' match) don't count as writes.
    const statements = verifier
      .split('\n')
      .filter((l) => !l.trim().startsWith('--'))
      .join('\n')
      .split(';')
      .map((s) => s.trim())
      .filter(Boolean)
    expect(statements.length).toBeGreaterThan(0)
    for (const s of statements) {
      expect(s.toLowerCase().startsWith('select')).toBe(true)
    }
  })
})

// TEST D (Codex correction pass #2): users.push_enabled is server-authority
// only. The kill switch is derived solely from a real, persisted subscription
// (the push/subscribe route, service_role) — the client must never be able to
// UPDATE it directly, so no environment may leave that grant in place.
describe('TEST D: users.push_enabled is not client-writable', () => {
  // Pull the single authenticated column-UPDATE grant on public.users.
  const authGrant = launchSecurity.match(
    /grant update \(([^)]*)\)\s*on public\.users to authenticated/i
  )

  it('the global-identity migration revokes authenticated UPDATE on push_enabled', () => {
    expect(migration).toMatch(
      /revoke update\s*\(\s*push_enabled\s*\)\s*on public\.users from authenticated/i
    )
  })

  it('migration_launch_security no longer grants authenticated UPDATE on push_enabled', () => {
    expect(authGrant).not.toBeNull()
    expect(authGrant![1]).not.toMatch(/push_enabled/i)
  })

  it('authenticated retains column UPDATE only for mode, seen_hints, notify_scratches, updated_at', () => {
    expect(authGrant).not.toBeNull()
    const cols = authGrant![1].split(',').map((c) => c.trim()).sort()
    expect(cols).toEqual(['mode', 'notify_scratches', 'seen_hints', 'updated_at'])
  })

  it('service_role is never stripped of push_enabled UPDATE (the route writes it as admin)', () => {
    // service_role bypasses column-level grants entirely; assert nothing in the
    // proposed migration revokes push_enabled (or table writes) from it.
    expect(migration).not.toMatch(/revoke[^;]*push_enabled[^;]*from service_role/i)
    expect(migration).not.toMatch(/revoke[^;]*on public\.users[^;]*from service_role/i)
  })

  it('the verifier proves the privileges via has_column_privilege (or equivalent catalog check)', () => {
    expect(verifier).toMatch(/has_column_privilege/i)
    expect(verifier).toMatch(/push_enabled/)
    // Both roles are asserted: authenticated must NOT have it, service_role must.
    expect(verifier).toMatch(/authenticated/i)
    expect(verifier).toMatch(/service_role/i)
  })
})
