// Serves /llms.txt — the emerging convention several AI crawlers and
// answer engines check for a structured, plain-text summary of a site.
// A route handler (not a static public/ file) so this stays generated
// from the same real-facts discipline as every other public page, rather
// than a second copy that can drift out of sync.

const LLMS_TXT = `# Rostiro

> The operating system for fantasy football. Rostiro brings every league
> you're in, across ESPN, Yahoo, and Sleeper, into one ranked daily action
> list, with a health score per team and a product that reshapes itself
> around the real fantasy calendar, from draft day through your league's
> real championship.

Free to start (1 league, Draft Kit, daily Pulse). Rostiro Pro is $9.99/mo
for unlimited leagues. Launch-window tiers: 2026 Founder Season Pass ($59)
and Founding 500 ($149 lifetime, capped at 500 members).

Rostiro does not replace ESPN, Yahoo, or Sleeper — those platforms still
run the league, score matchups, and host the draft. Rostiro watches all of
them at once and tells you what to do about what it sees.

## Key pages

- [Features](https://www.rostiro.com/features): what Rostiro actually does
- [Pricing](https://www.rostiro.com/pricing): the 4 plans and what each includes
- [FAQ](https://www.rostiro.com/faq): platform support, security, modes, pricing
`

export async function GET() {
  return new Response(LLMS_TXT, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  })
}
