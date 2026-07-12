-- Positive #wins pings: new signup + Founding-500 milestones.
-- Applied to the live project via MCP as migration add_wins_events_triggers.
--
-- These use CUSTOM trigger functions (net.http_post) rather than the generic
-- supabase_functions.http_request so that ONLY non-PII fields leave the DB —
-- no email / stripe ids ever reach n8n Cloud's execution logs. (The sale_ping
-- trigger still uses the generic helper; tightening it the same way is a
-- security-phase follow-up.)

-- New signup: handle_new_user() creates a public.users row on auth signup, so
-- an insert here == a real new signup. Sends only a running total, no PII.
create or replace function public.notify_new_signup()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform net.http_post(
    url := 'https://rostiro.app.n8n.cloud/webhook/wins-events',
    body := jsonb_build_object('event', 'signup', 'total', (select count(*) from public.users)),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer <SUPABASE_N8N_WEBHOOK_SECRET>'
    )
  );
  return new;
end $$;

create trigger new_signup
after insert on public.users
for each row execute function public.notify_new_signup();

-- Founding-500 milestones. Fires once, only when founding_number transitions to
-- a milestone value (old is distinct from new). Sends only the number.
create or replace function public.notify_founding_milestone()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform net.http_post(
    url := 'https://rostiro.app.n8n.cloud/webhook/wins-events',
    body := jsonb_build_object('event', 'milestone', 'number', new.founding_number),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer <SUPABASE_N8N_WEBHOOK_SECRET>'
    )
  );
  return new;
end $$;

create trigger founding_milestone
after update on public.users
for each row
when (
  new.founding_number in (100, 250, 400, 500)
  and old.founding_number is distinct from new.founding_number
)
execute function public.notify_founding_milestone();
