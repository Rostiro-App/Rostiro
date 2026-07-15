// Uploads every file in /video-drops to the marketing-assets Supabase
// Storage bucket, and registers each one in the marketing_assets table so
// Jarvis's asset_search can find it. Run by Claude Code on request (e.g.
// "upload the videos in video-drops") -- not part of the app's runtime,
// same category as the demo-game-day-* scripts.
//
// Requires migration_marketing_assets_video.sql to have been applied
// first (adds 'video' to the kind check constraint) -- run against
// Supabase Studio's SQL editor once, this script doesn't run migrations.
//
// Usage: node scripts/upload-video-assets.mjs [--pillar=founder] [--topic=origin-hook] [--aspect=9:16]
// With no flags, every file in video-drops/ is uploaded using its own
// filename (minus extension) as the topic, and no pillar/aspect set --
// fine for a quick batch upload; pass flags when uploading one file with
// real metadata worth setting up front.

import { createClient } from '@supabase/supabase-js'
import { readFileSync, readdirSync, statSync } from 'fs'
import { extname, basename, join } from 'path'

const env = Object.fromEntries(
  readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    .split('\n')
    .filter((l) => l.includes('=') && !l.startsWith('#'))
    .map((l) => {
      const i = l.indexOf('=')
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()]
    })
)

const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)

const args = Object.fromEntries(
  process.argv.slice(2).filter((a) => a.startsWith('--')).map((a) => {
    const [k, v] = a.slice(2).split('=')
    return [k, v ?? true]
  })
)

const VIDEO_MIME = { '.mp4': 'video/mp4', '.mov': 'video/quicktime', '.webm': 'video/webm' }

const dropDir = new URL('../video-drops/', import.meta.url)
const files = readdirSync(dropDir).filter((f) => {
  if (f.startsWith('.') || f === 'README.md') return false
  return statSync(new URL(f, dropDir)).isFile()
})

if (files.length === 0) {
  console.log('No files in video-drops/ (besides README.md) -- nothing to upload.')
  process.exit(0)
}

console.log(`Found ${files.length} file(s) to upload:`, files)

for (const filename of files) {
  const ext = extname(filename).toLowerCase()
  const contentType = VIDEO_MIME[ext]
  if (!contentType) {
    console.warn(`Skipping ${filename} -- unrecognized extension ${ext} (expected .mp4/.mov/.webm)`)
    continue
  }

  const buffer = readFileSync(new URL(filename, dropDir))
  const storagePath = `raw-video/${filename}`

  const { error: uploadError } = await admin.storage
    .from('marketing-assets')
    .upload(storagePath, buffer, { contentType, upsert: true })
  if (uploadError) {
    console.error(`Upload failed for ${filename}:`, uploadError.message)
    continue
  }

  const topic = args.topic || basename(filename, ext)
  const { error: insertError } = await admin.from('marketing_assets').insert({
    storage_path: storagePath,
    kind: 'video',
    pillar: args.pillar ?? null,
    topic,
    aspect: args.aspect ?? null,
    description: `Raw Simulation Studio capture: ${filename}`,
  })
  if (insertError) {
    console.error(`Storage upload OK but marketing_assets insert failed for ${filename}:`, insertError.message)
    console.error(`(If this says the check constraint rejected 'video', migration_marketing_assets_video.sql hasn't been applied yet.)`)
    continue
  }

  console.log(`✓ ${filename} -> ${storagePath} (topic: ${topic})`)
}
