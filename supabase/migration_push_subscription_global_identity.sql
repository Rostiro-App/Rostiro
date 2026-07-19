-- Migration: global push-subscription identity (P3.5-4C correction pass)
--
-- PROPOSED — do NOT apply automatically. Apply only after the read-only
-- verifier (verify_push_subscription_global_identity.sql) confirms the
-- precondition below is met in the target environment.
--
-- Root problem (Codex): push_subscriptions only had unique(user_id,
-- onesignal_player_id). The claimed invariant "one OneSignal subscription
-- belongs to exactly one Rostiro user" was enforced only in application code
-- (app/api/push/subscribe reassigns on account switch) and could be violated
-- by concurrent account-switch requests. This adds the DB-level backstop.
--
-- The existing composite unique(user_id, onesignal_player_id) is PRESERVED —
-- it remains the conflict target for the route's upsert
-- (onConflict: 'user_id,onesignal_player_id'). The new global unique index on
-- onesignal_player_id alone is additive: normal flow (the route deletes any
-- other user's row for this id before upserting) never trips it; two
-- simultaneous account-switch upserts for the same id now have one rejected by
-- the database instead of both succeeding.

begin;

-- Precondition: abort if any onesignal_player_id is already owned by more than
-- one row. Applying the unique index over existing duplicates would fail
-- mid-statement; failing loudly here, before any change, is safer and names the
-- problem. Reconcile duplicates first, then re-run.
do $$
declare
  duplicate_ids integer;
begin
  select count(*) into duplicate_ids
  from (
    select onesignal_player_id
    from public.push_subscriptions
    where onesignal_player_id is not null
    group by onesignal_player_id
    having count(*) > 1
  ) dups;

  if duplicate_ids > 0 then
    raise exception
      'Aborting: % onesignal_player_id value(s) are owned by more than one row. Reconcile duplicates before enforcing global identity.',
      duplicate_ids;
  end if;
end $$;

-- Global uniqueness backstop. IF NOT EXISTS keeps the migration idempotent.
-- onesignal_player_id is NOT NULL in the schema, so a full unique index is
-- sufficient (no partial predicate needed).
create unique index if not exists push_subscriptions_onesignal_player_id_global_key
  on public.push_subscriptions (onesignal_player_id);

-- Column authority (Codex correction pass #2): users.push_enabled is the push
-- kill switch, and it is server-authority ONLY. It is derived solely from a
-- real, persisted subscription by app/api/push/subscribe/route.ts using the
-- service_role admin client — the browser must never be able to set it. The
-- earlier migration_launch_security.sql column grant mistakenly included it,
-- letting any logged-in user flip their own kill switch true via PostgREST
-- with no subscription behind it. Revoke it explicitly (any environment that
-- already ran the old grant has it live and needs it actively removed, not
-- just left out of a fresh setup). service_role is untouched — it bypasses
-- column-level grants and still writes push_enabled. The authenticated client
-- keeps its legitimate column writes (mode, seen_hints, notify_scratches,
-- updated_at), which migration_launch_security.sql now grants without
-- push_enabled.
revoke update (push_enabled) on public.users from authenticated;

commit;
