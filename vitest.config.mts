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
  test: { environment: 'jsdom', globals: true, include: ['app/demo/**/*.test.{ts,tsx}', 'components/marketing/scenes/**/*.test.{ts,tsx}', 'components/interrupt/**/*.test.{ts,tsx}', 'components/settings/**/*.test.{ts,tsx}', 'lib/**/*.test.ts', 'app/api/**/*.test.ts'], setupFiles: ['./app/demo/test-setup.ts'] },
  resolve: { alias: { '@': fileURLToPath(new URL('.', import.meta.url)) } },
})
