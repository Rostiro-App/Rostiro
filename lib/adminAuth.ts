// Launch security hardening (Codex Implementation Packet 01): a real
// server-side admin identity, replacing two prior patterns that both had
// real problems — app/api/admin/errors/route.ts checked `plan ===
// 'commissioner'` (a purchasable product tier, not an administrative role;
// combined with the users-table grant fix in migration_launch_security.sql,
// self-promoting to commissioner would otherwise have granted access to the
// global error log), and app/api/admin/simulate/route.ts + loadFounderLeagues
// (lib/simScenarios.ts) checked the session email against ADMIN_EMAIL (less
// severe — email comes from a verified Supabase Auth session, not client
// input — but still coupled admin identity to a value that can change).
//
// ADMIN_USER_ID is a fixed UUID, set once, never derived from anything the
// user can influence (plan, email, founding number). Fails closed on every
// missing/malformed/mismatched case.

import { createSSRClient } from './supabase'
import type { User } from '@supabase/supabase-js'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function requireAdmin(): Promise<User | null> {
  const adminUserId = process.env.ADMIN_USER_ID
  if (!adminUserId || !UUID_RE.test(adminUserId)) return null

  const supabase = await createSSRClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user || user.id !== adminUserId) return null
  return user
}

// For non-route callers (e.g. lib/simScenarios.ts) that need the admin's
// user id directly rather than a full auth check — same fail-closed
// validation on the env var, no session involved since these run
// server-side against the admin client already.
export function requireAdminUserId(): string {
  const adminUserId = process.env.ADMIN_USER_ID
  if (!adminUserId || !UUID_RE.test(adminUserId)) {
    throw new Error('ADMIN_USER_ID is not configured — set it to a real user UUID before using admin-only server functions')
  }
  return adminUserId
}
