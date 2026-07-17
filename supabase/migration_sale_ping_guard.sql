-- Sale ping false-positive guard (found 2026-07-16 while verifying the
-- Launch Security migration): `sale_ping`'s WHEN clause only compares
-- NEW.plan vs OLD.plan rank on ANY update to public.users — it has no
-- concept of a real Stripe event. A manual SQL UPDATE (or the admin
-- simulate route's force_plan, or any future ad-hoc script) that raises a
-- user's plan rank fires a real "sale" ping to Discord #wins, identical to
-- a real $9.99 conversion. Confirmed: running supabase/verify_launch_security.sql
-- against production briefly set a throwaway test account to plan='pro' and
-- fired a false Discord notification, even though no Stripe charge occurred.
--
-- Fix: route every legitimate plan write through a SECURITY DEFINER function
-- that sets a transaction-local flag before writing, and make the trigger
-- require that flag. Idempotent; safe to re-run.

-- ─── 1. Guard the trigger on a transaction-local flag ───────────────────────
drop trigger if exists sale_ping on public.users;
create trigger sale_ping
after update on public.users
for each row
when (
  coalesce(current_setting('rostiro.sale_source', true), '') = 'stripe_webhook'
  and (
    public.plan_rank(new.plan) > public.plan_rank(old.plan)
    or (new.founding_number is not null and old.founding_number is null)
  )
)
execute function public.notify_sale();

-- ─── 2. RPC for checkout.session.completed's plan write ─────────────────────
-- Sets the flag and performs the update inside a single function call, so
-- it's the same transaction the trigger fires in (set_config(..., true) is
-- transaction-local — it cannot leak into or be set by any other request).
create or replace function public.stripe_finalize_checkout_plan(
  p_user_id uuid,
  p_plan text,
  p_stripe_subscription_id text default null,
  p_season_pass_expires_at timestamptz default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform set_config('rostiro.sale_source', 'stripe_webhook', true);
  update public.users
  set
    plan = p_plan,
    stripe_subscription_id = case when p_plan = 'pro' then p_stripe_subscription_id else stripe_subscription_id end,
    season_pass_expires_at = case when p_plan = 'starter' then p_season_pass_expires_at else season_pass_expires_at end
  where id = p_user_id;
end;
$$;

revoke all on function public.stripe_finalize_checkout_plan(uuid, text, text, timestamptz) from public, anon, authenticated;
grant execute on function public.stripe_finalize_checkout_plan(uuid, text, text, timestamptz) to service_role;

-- ─── 3. RPC for customer.subscription.deleted's downgrade-to-free write ─────
-- This is a downward plan move so it never fired sale_ping anyway (see the
-- original migration's comment) — routed through the same guarded pattern
-- purely for consistency, so every write that touches plan goes through one
-- audited path rather than half going through raw .update() calls.
create or replace function public.stripe_finalize_cancellation(p_customer_id text)
returns table (email text)
language plpgsql
security definer
set search_path = public
as $$
begin
  perform set_config('rostiro.sale_source', 'stripe_webhook', true);
  return query
    update public.users
    set plan = 'free', stripe_subscription_id = null
    where stripe_customer_id = p_customer_id
    returning users.email;
end;
$$;

revoke all on function public.stripe_finalize_cancellation(text) from public, anon, authenticated;
grant execute on function public.stripe_finalize_cancellation(text) to service_role;

-- ─── 4. Close the actual resource-exhaustion hole in founding_number ────────
-- assign_founding_number (migration_founder_recognition.sql) was created
-- with no explicit REVOKE, so Postgres's default PUBLIC execute grant was
-- still live — any authenticated user could call
-- `select public.assign_founding_number(auth.uid())` directly via PostgREST
-- and claim a real Founding 500 slot (a scarce, capped resource) for free,
-- with no Stripe charge at all. Only app/api/stripe/webhook/route.ts calls
-- this today, always via the service-role admin client, so restricting
-- execute to service_role changes no legitimate behavior.
revoke all on function public.assign_founding_number(uuid) from public, anon, authenticated;
grant execute on function public.assign_founding_number(uuid) to service_role;
