-- Founder recognition migration (T-111) — run once in the Supabase SQL editor.
-- Section 9 promises Founding 500 three things: lifetime access (real,
-- plan='commissioner' already gates this), a founder badge (T-110, shipped),
-- priority feedback access, and early feature previews. This migration
-- builds the schema for the first two of those three still-missing pieces.
-- Early feature previews deliberately NOT touched here — no per-user
-- feature-flag targeting exists yet (lib/featureFlags.ts is global on/off
-- only), and there's no actual feature queued for early access yet either,
-- so building that targeting now would be speculative infrastructure with
-- nothing real to preview. Revisit when a real feature needs it.

-- ─── Founding Member numbering ────────────────────────────────────────────
-- Real assignment happens at Stripe checkout once T-85 ships (the webhook
-- calls assign_founding_number()); built schema-ready now so that's a
-- non-event later, not a new migration. nextval() on a sequence is atomic,
-- so this is race-safe even if two checkouts complete in the same instant —
-- something a plain "select max(founding_number)+1" would not be.
create sequence if not exists public.founding_number_seq start 1;

alter table public.users
  add column if not exists founding_number int unique;

create or replace function public.assign_founding_number(p_user_id uuid)
returns int
language plpgsql
security definer
as $$
declare
  v_number int;
begin
  select founding_number into v_number from public.users where id = p_user_id;
  if v_number is not null then
    return v_number; -- idempotent — re-calling for an already-numbered user just returns it
  end if;

  v_number := nextval('public.founding_number_seq');
  if v_number > 500 then
    raise exception 'Founding 500 is sold out';
  end if;

  update public.users set founding_number = v_number where id = p_user_id;
  return v_number;
end;
$$;

-- To manually assign yourself (or any test account) a real Founding number
-- today, ahead of T-85's Stripe webhook wiring this up automatically:
--   select public.assign_founding_number('<user-uuid-here>');

-- ─── Priority feedback access ──────────────────────────────────────────────
-- A real, separate channel from generic support — Founding 500 only,
-- enforced in app/api/founder/feedback/route.ts (checks plan='commissioner'
-- before insert, not just at the UI layer).
create table if not exists public.founder_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  message text not null,
  status text not null default 'new' check (status in ('new', 'read', 'actioned')),
  created_at timestamptz not null default now()
);

create index if not exists founder_feedback_user_id_idx on public.founder_feedback(user_id);
create index if not exists founder_feedback_status_idx on public.founder_feedback(status);

-- Added 2026-07-08 (found while verifying the email suite): this table was
-- missing RLS policies and grants.sql access from day one — RLS was
-- enabled (likely via the dashboard's Security Advisor) with zero
-- policies attached, which is deny-all, so every real feedback submission
-- failed with a permission error. Every other table in this codebase
-- follows this same enable-RLS + policy + grant pattern (see
-- supabase/schema.sql); this one was the one exception. Safe to re-run —
-- idempotent.
alter table public.founder_feedback enable row level security;

drop policy if exists "Users can manage their own founder feedback" on public.founder_feedback;
create policy "Users can manage their own founder feedback" on public.founder_feedback
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

grant select, insert on public.founder_feedback to authenticated;
