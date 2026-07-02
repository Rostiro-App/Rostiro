// Supabase client helpers for Next.js App Router
// - browser(): client components (anon key, respects RLS)
// - server(): API routes & server components (service role, bypasses RLS)
// - createSSRClient(): cookie-based auth for server components reading user session

import { createClient } from '@supabase/supabase-js'
import { createServerClient as createSupabaseServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// Browser / client-side — safe to use in React client components
export const browserClient = createClient(supabaseUrl, supabaseAnonKey)

// Server-side only — bypasses RLS, full access. Use in API routes.
export function createAdminClient() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceRoleKey) throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set')
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

// Session-aware server client — reads auth cookies, enforces RLS.
// Use in server components and API routes that need the current user's identity.
export async function createSSRClient() {
  const cookieStore = await cookies()
  return createSupabaseServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          )
        } catch {
          // setAll called from a Server Component — safe to ignore
        }
      },
    },
  })
}
