import { createSSRClient } from '@/lib/supabase'
import { NextResponse } from 'next/server'

export async function POST() {
  const supabase = await createSSRClient()
  await supabase.auth.signOut()
  return NextResponse.redirect(
    new URL('/login', process.env.NEXT_PUBLIC_APP_URL ?? 'https://rostiro.vercel.app')
  )
}
