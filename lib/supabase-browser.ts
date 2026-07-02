// Browser-only Supabase client — safe to import in client components ('use client')
import { createClient } from '@supabase/supabase-js'

export const browserClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)
