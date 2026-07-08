// T-111: Founding Member numbering. Real assignment happens at Stripe
// checkout once T-85 ships — this is the one function that call site
// should invoke; nothing today calls it automatically since there's no
// real purchase flow yet, but it's ready so wiring it in later is a
// one-line addition to the webhook handler, not a new build.

import type { SupabaseClient } from '@supabase/supabase-js'

export async function assignFoundingNumber(
  admin: SupabaseClient,
  userId: string
): Promise<number | null> {
  const { data, error } = await admin.rpc('assign_founding_number', { p_user_id: userId })
  if (error) {
    // 42883 (Postgres "function does not exist") / PGRST202 (PostgREST's
    // equivalent schema-cache miss) both mean migration_founder_recognition.sql
    // hasn't run yet — degrade honestly, same pattern as every other
    // not-yet-migrated column check in this codebase, rather than 500ing.
    if (error.code === '42883' || error.code === 'PGRST202') return null
    throw new Error(error.message)
  }
  return data as number
}

// Current count of assigned Founding numbers — used to show remaining
// slots on /upgrade and to reject new Founding 500 checkouts early once
// sold out (the hard enforcement is still assign_founding_number()'s own
// exception; this is just a friendlier pre-check, same one function
// backing both call sites so they can never disagree).
export async function getFoundingCount(admin: SupabaseClient): Promise<number> {
  const { count, error } = await admin
    .from('users')
    .select('id', { count: 'exact', head: true })
    .not('founding_number', 'is', null)
  if (error) {
    // 42703: founding_number column doesn't exist yet (migration not run) —
    // degrade to 0 rather than 500ing, same posture as assignFoundingNumber.
    if (error.code === '42703') return 0
    throw new Error(error.message)
  }
  return count ?? 0
}
