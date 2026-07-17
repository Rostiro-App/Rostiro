-- Yahoo token custody hardening (Packet 02, Section 7). Encrypted Yahoo
-- OAuth tokens are server credentials even ciphertext-encrypted — an
-- authenticated client could previously select/insert/update/delete their
-- own yahoo_tokens row directly via PostgREST (RLS policy was "for all
-- using (auth.uid() = user_id)", and grants.sql granted authenticated full
-- CRUD on the table). Every real read/write path in the app already goes
-- through the service-role admin client
-- (app/api/auth/yahoo/callback/route.ts, lib/yahoo.ts's
-- getValidYahooAccessToken) — authenticated never legitimately needed
-- this table at all. This is a forward migration (not an edit to
-- schema.sql's original CREATE, which now reflects the corrected posture
-- for fresh environments) because this table already exists in production
-- under the old, looser grant.
--
-- Idempotent; safe to re-run.

-- ─── 1. Revoke authenticated's table-wide access ────────────────────────────
revoke select, insert, update, delete on public.yahoo_tokens from authenticated;

-- ─── 2. Replace the per-user RLS policy with a service-role-only one ────────
-- Same pattern as rate_limit_events/app_error_log (migration_rate_limit.sql,
-- migration_error_log.sql) — service_role bypasses RLS in Supabase
-- regardless, but an explicit policy documents intent and is defense-in-
-- depth against a future grant regression.
drop policy if exists "Users can manage own Yahoo tokens" on public.yahoo_tokens;
drop policy if exists "Service role can manage Yahoo tokens" on public.yahoo_tokens;
create policy "Service role can manage Yahoo tokens" on public.yahoo_tokens
  for all using (auth.role() = 'service_role');

-- ─── 3. Re-assert service_role's own access explicitly ──────────────────────
-- Redundant with "grant all on all tables to service_role" (grants.sql),
-- but explicit here so this migration is self-contained and correct even
-- run against an environment that predates that blanket grant.
grant select, insert, update, delete on public.yahoo_tokens to service_role;
