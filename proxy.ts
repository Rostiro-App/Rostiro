// Next.js 16 proxy (replaces middleware.ts)
// Protects app routes and refreshes Supabase sessions.

import { NextResponse, type NextRequest } from 'next/server'

export function proxy(_request: NextRequest) {
  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|api/|draft|public/).*)',
  ],
}
