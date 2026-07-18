import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  plugins: [react()],
  // app/api/**/*.test.ts added for launch security hardening (Codex Packet
  // 01) — route-handler tests for the admin/cron/rate-limit boundaries
  // didn't have anywhere to run before this, since no app/api test glob
  // existed at all. components/settings/**/*.test.{ts,tsx} added for
  // Packet 02's Yahoo connection UX tests — same gap, a different folder.
  // components/onboarding/**/*.test.{ts,tsx} and app/(auth)/**/*.test.{ts,tsx}
  // added for the Packet 02 correction pass's OAuth-lifecycle regression
  // tests — same recurring gap, yet more folders. app/faq/**/*.test.{ts,tsx}
  // added for the same pass's FAQ write-access-copy regression test.
  // scripts/**/*.test.ts added (P3-11D) for
  // scripts/seedPlayerMappings.test.ts — the first scripts/*.mts runner to
  // get real regression tests (applyActions exported specifically for
  // this, guarded behind an entrypoint check so importing it for testing
  // never triggers the script's live main()).
  test: { environment: 'jsdom', globals: true, include: ['app/demo/**/*.test.{ts,tsx}', 'components/marketing/scenes/**/*.test.{ts,tsx}', 'components/interrupt/**/*.test.{ts,tsx}', 'components/settings/**/*.test.{ts,tsx}', 'components/onboarding/**/*.test.{ts,tsx}', 'app/[(]auth[)]/**/*.test.{ts,tsx}', 'app/faq/**/*.test.{ts,tsx}', 'lib/**/*.test.ts', 'app/api/**/*.test.ts', 'scripts/**/*.test.ts'], setupFiles: ['./app/demo/test-setup.ts'] },
  resolve: { alias: { '@': fileURLToPath(new URL('.', import.meta.url)) } },
})
