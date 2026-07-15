# Drop raw video captures here

Export your Simulation Studio recordings and save them directly into this folder — that's it. This folder is gitignored, nothing here ever gets committed.

When you're ready, tell Claude Code (not Jarvis — Jarvis has no access to your machine) something like "upload the videos in video-drops." It'll run `scripts/upload-video-assets.mjs`, which:

1. Uploads each file to the `marketing-assets` Supabase Storage bucket, under `raw-video/<filename>`.
2. Registers it in the `marketing_assets` table (same table Jarvis's `asset_search` reads from), so it's immediately findable by Jarvis for captioning and scheduling.
3. Leaves the local file in place (safe to delete manually once you've confirmed the upload).

Naming tip: name each file something descriptive before dropping it in (e.g. `origin-hook.mp4`, `waiver-day-heist.mp4`) — the filename becomes the default topic tag unless you tell Claude Code otherwise when asking it to upload.
