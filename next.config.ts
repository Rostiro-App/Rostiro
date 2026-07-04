import type { NextConfig } from "next";

// T-76: security headers. No nonce-based strict CSP yet — that needs a
// middleware pass threading a per-request nonce through every inline
// <script>/<style>, a bigger lift than this pass covers — so script-src and
// style-src keep 'unsafe-inline' for now rather than quietly breaking
// hydration or every inline `style={{...}}` in the app. Everything else
// (frame-ancestors, object-src, connect-src) is locked down for real.
//
// 'unsafe-eval' is dev-only: Next/React's dev-mode tooling (Turbopack fast
// refresh, reconstructing call stacks) uses eval(), confirmed via a real
// console error locally — "React will never use eval() in production
// mode" per React's own message, so this never weakens the real, deployed
// CSP a user's browser actually enforces.
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline' https://cdn.onesignal.com${process.env.NODE_ENV !== 'production' ? " 'unsafe-eval'" : ''}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: https:",
  "font-src 'self'",
  "connect-src 'self' https://*.supabase.co https://*.onesignal.com wss://*.onesignal.com",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ')

const securityHeaders = [
  { key: 'Content-Security-Policy', value: csp },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=()' },
]

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: '/:path*',
        headers: securityHeaders,
      },
    ]
  },
};

export default nextConfig;
