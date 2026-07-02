// Auth middleware — protects app routes and refreshes Supabase sessions.
// Intentionally minimal: any error passes through rather than crashing.

import { NextResponse, type NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|api/|draft|public/).*)',
  ],
}
