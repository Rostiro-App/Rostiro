import type { MetadataRoute } from 'next'

const BASE_URL = 'https://www.rostiro.com'

// Private app surfaces + API — no SEO value, nothing here should be
// crawled or indexed. See Global Constraints for how this list was derived.
const DISALLOWED = [
  '/api/',
  '/dashboard',
  '/draft',
  '/pulse',
  '/start-sit',
  '/trade',
  '/admin',
  '/leagues',
  '/lineup',
  '/live',
  '/profile',
  '/settings',
  '/trades',
  '/upgrade',
  '/onboarding',
  '/reset-password',
]

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: DISALLOWED,
      },
      // AI training bots — explicitly allowed per founder's call to
      // maximize pre-launch awareness, not left to default-allow.
      { userAgent: 'GPTBot', allow: '/', disallow: DISALLOWED },
      { userAgent: 'CCBot', allow: '/', disallow: DISALLOWED },
      { userAgent: 'Google-Extended', allow: '/', disallow: DISALLOWED },
      { userAgent: 'ClaudeBot', allow: '/', disallow: DISALLOWED },
      // AI answer/citation bots — fetch pages live to answer a specific
      // user's question and cite Rostiro.
      { userAgent: 'OAI-SearchBot', allow: '/', disallow: DISALLOWED },
      { userAgent: 'ChatGPT-User', allow: '/', disallow: DISALLOWED },
      { userAgent: 'PerplexityBot', allow: '/', disallow: DISALLOWED },
    ],
    sitemap: `${BASE_URL}/sitemap.xml`,
  }
}
