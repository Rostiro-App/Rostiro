// Packet 03, P3-6: compatibility parser for portfolio_exposure_snapshots
// rows written before this packet. Old rows (schema_version 1, the
// column's DEFAULT — see supabase/migration_portfolio_schema_version.sql,
// not yet applied) hold a RAW SLEEPER PLAYER ID in `player_id`; new rows
// (schema_version 2, written explicitly by the P3-6 pipeline) hold a
// canonical player_mappings.id (a uuid). A reader that doesn't check
// schema_version and just treats every row's player_id as canonical would
// misattribute every pre-P3-6 row's exposure — this file exists so that
// mistake requires deliberately ignoring its return value, not making it
// by omission.

export type PlayerIdSpace = 'sleeper_raw' | 'canonical'

export interface StoredExposureRow {
  player_id: string
  schema_version?: number | null
  player_id_space?: string | null
}

export interface ParsedExposureIdentity {
  schemaVersion: number
  idSpace: PlayerIdSpace
  playerId: string
  // true when this row predates schema_version/player_id_space existing
  // at all (the migration hasn't been applied to this environment yet) —
  // callers should treat this exactly like schema_version 1.
  isLegacyUnversioned: boolean
}

/**
 * Parses a raw portfolio_exposure_snapshots row into an explicit identity
 * space, defaulting to the pre-P3-6 assumption (schema_version 1,
 * sleeper_raw) when the row (or the whole environment, pre-migration)
 * carries no version info at all — the same default the migration itself
 * uses, so behavior is identical whether or not the migration has run.
 */
export function parseStoredExposureRow(row: StoredExposureRow): ParsedExposureIdentity {
  const isLegacyUnversioned = row.schema_version == null && row.player_id_space == null
  const schemaVersion = row.schema_version ?? 1
  const idSpace: PlayerIdSpace = row.player_id_space === 'canonical' ? 'canonical' : 'sleeper_raw'

  return { schemaVersion, idSpace, playerId: row.player_id, isLegacyUnversioned }
}

/**
 * True only when a row is genuinely safe to treat as a canonical
 * player_mappings.id — schema_version 2 AND player_id_space explicitly
 * 'canonical'. Every legacy/ambiguous case (including a malformed row
 * claiming version 2 but space 'sleeper_raw', which should never happen
 * but is deliberately not trusted if it does) returns false rather than a
 * guess.
 */
export function isCanonicalExposureIdentity(row: StoredExposureRow): boolean {
  const parsed = parseStoredExposureRow(row)
  return parsed.schemaVersion >= 2 && parsed.idSpace === 'canonical'
}
