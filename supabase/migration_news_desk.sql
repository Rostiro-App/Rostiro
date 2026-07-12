-- News Desk auto-inbox trigger. Applied to the live project via MCP as
-- add_news_desk_inbox_trigger.
--
-- On a new relevant news_item (mentions >= 1 real player), push it to n8n, which
-- has Claude Haiku draft ONE product-anchored angle and drops headline + link +
-- angle into Discord #headline-inbox as a postable draft. news_items holds only
-- public news (no PII), so the generic http_request payload is fine here.
--
-- Relevance gate: player_ids is NOT NULL on this table, so "no players" is an
-- empty array; array_length(...) is null for empty, so only headlines that
-- actually mention a player get through — no generic-news noise.
create trigger news_desk_inbox
after insert on public.news_items
for each row
when (new.player_ids is not null and array_length(new.player_ids, 1) > 0)
execute function supabase_functions.http_request(
  'https://rostiro.app.n8n.cloud/webhook/news-desk',
  'POST',
  '{"Content-Type":"application/json","Authorization":"Bearer <SUPABASE_N8N_WEBHOOK_SECRET>"}',
  '{}',
  '5000'
);
