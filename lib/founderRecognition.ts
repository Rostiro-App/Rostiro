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
