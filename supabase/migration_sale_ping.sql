-- Sale ping (revenue notification). Pushes to Discord #wins when a user upgrades
-- into or between paid plans, or is assigned a Founding 500 number. Positive/money
-- event, deliberately routed to a SEPARATE channel from #alerts (errors/monitoring)
-- via its own n8n Discord credential (Discord Wins Webhook).
--
-- Applied to the live project via MCP as migration add_sale_ping_webhook.

-- Plan tiers, mirroring lib/stripe.ts PLAN_RANK:
--   free < starter (Founder Season Pass $59) < pro (Rostiro Pro $9.99/mo)
--   < commissioner (Founding 500 $149 lifetime).
create or replace function public.plan_rank(p text)
returns int language sql immutable as $$
  select case coalesce(p, 'free')
    when 'free'         then 0
    when 'starter'      then 1
    when 'pro'          then 2
    when 'commissioner' then 3
    else 0
  end
$$;

-- Fire only on an UPWARD move (a real sale/upgrade) or a newly assigned Founding
-- 500 number. The season-pass-expiry cron's downgrade (starter -> free) is a
-- lower rank, so it never pings as a sale.
create trigger sale_ping
after update on public.users
for each row
when (
  public.plan_rank(new.plan) > public.plan_rank(old.plan)
  or (new.founding_number is not null and old.founding_number is null)
)
execute function supabase_functions.http_request(
  'https://rostiro.app.n8n.cloud/webhook/sale-ping',
  'POST',
  '{"Content-Type":"application/json","Authorization":"Bearer <SUPABASE_N8N_WEBHOOK_SECRET>"}',
  '{}',
  '5000'
);
