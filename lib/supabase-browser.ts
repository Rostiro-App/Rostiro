// Browser-only Supabase client — safe to import in client components ('use client')
// Uses createBrowserClient from @supabase/ssr so the session is stored in cookies,
// which the server-side SSR client can read. createClient from supabase-js uses
// localStorage and the server never sees the session.
import { createBrowserClient } from '@supabase/ssr'

export const browserClient = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)
