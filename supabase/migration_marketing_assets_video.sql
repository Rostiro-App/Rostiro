-- Adds 'video' as a valid marketing_assets.kind, for raw Simulation Studio
-- captures (Lawrence records, uploads the raw file to the marketing-assets
-- bucket himself via the Supabase dashboard, then has the cockpit register
-- the row so asset_search can find it). Same bucket/table as screenshots
-- and generated cards -- no new storage location, just a new kind value.
--
-- Postgres check constraints can't be altered in place; drop and recreate.
alter table public.marketing_assets drop constraint marketing_assets_kind_check;
alter table public.marketing_assets add constraint marketing_assets_kind_check
  check (kind in ('screenshot', 'generated_card', 'video'));
