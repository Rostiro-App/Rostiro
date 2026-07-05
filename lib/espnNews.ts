// T-95 follow-up: ESPN NFL RSS ingestion (PRD 5.7's "let Claude do
// web-grounded reasoning, don't pre-ingest a corpus" ruling still holds for
// analysis — this is the deterministic signal layer underneath it: headline,
// ESPN's own excerpt, byline, link. Per ESPN's stated RSS terms
// (espn.com/espn/news/story?page=rssinfo): display only what the feed
// provides, don't alter title/summary/link, credit ESPN, link to the full
// article, no ads. This is syndication, not republishing — Rostiro never
// stores or shows full article text.

const FEED_URL = 'https://www.espn.com/espn/rss/nfl/news'

export interface EspnNewsItem {
  id: string
  headline: string
  summary: string | null
  author: string | null
  link: string
  publishedAt: string
}

function extractTag(xml: string, tag: string): string | null {
  const match = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'i'))
  if (!match) return null
  const raw = match[1].trim()
  const cdata = raw.match(/^<!\[CDATA\[([\s\S]*)\]\]>$/)
  return (cdata ? cdata[1] : raw).trim()
}

export async function fetchEspnNflNews(): Promise<EspnNewsItem[]> {
  const res = await fetch(FEED_URL, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; RostiroBot/1.0)' },
    next: { revalidate: 0 },
  })
  if (!res.ok) throw new Error(`ESPN RSS fetch failed: ${res.status}`)
  const xml = await res.text()

  const itemBlocks = xml.match(/<item>[\s\S]*?<\/item>/g) ?? []

  return itemBlocks
    .map((block): EspnNewsItem | null => {
      const guid = extractTag(block, 'guid')
      const link = extractTag(block, 'link')
      const headline = extractTag(block, 'title')
      const pubDateRaw = extractTag(block, 'pubDate')
      if (!guid || !link || !headline || !pubDateRaw) return null

      const publishedAt = new Date(pubDateRaw)
      if (Number.isNaN(publishedAt.getTime())) return null

      return {
        id: guid,
        headline,
        summary: extractTag(block, 'description'),
        author: extractTag(block, 'dc:creator'),
        link,
        publishedAt: publishedAt.toISOString(),
      }
    })
    .filter((item): item is EspnNewsItem => item !== null)
}
