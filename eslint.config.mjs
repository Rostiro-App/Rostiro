import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  {
    rules: {
      // Allow _prefixed parameters to mark intentionally unused args
      '@typescript-eslint/no-unused-vars': ['warn', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
      }],
    },
  },
  {
    files: ['app/demo/**/*.{ts,tsx}'],
    ignores: ['scripts/**'],
    rules: {
      'no-restricted-imports': ['error', {
        patterns: [
          { group: [
            '@/lib/supabase', '@/lib/supabase-browser', '@/lib/sleeper',
            '@/lib/espn', '@/lib/espnNews', '@/lib/yahoo',
            '@/lib/liveMatchupPoints', '@/lib/pulse',
          ], message: 'app/demo must stay in-memory: no Supabase/live-API/DB-coupled imports.' },
        ],
      }],
    },
  },
]);

export default eslintConfig;
