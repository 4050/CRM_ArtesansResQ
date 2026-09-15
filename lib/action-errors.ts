export interface PostgresErrorLike {
  code?: string
  message: string
}

// Shared by every server action that returns { data, error } or { error }
// from a Supabase call - so the very few call sites that need a strict
// discriminated union over T don't each redeclare the same type.
export type ActionResult<T> = { data: T; error?: undefined } | { data?: undefined; error: string }

// Two common, well-known Postgres/PostgREST error shapes get a friendlier
// message than the raw one an end user has no business seeing:
// - 23505 (unique violation) names the underlying constraint (e.g.
//   "consumables_organization_id_code_key") - meaningless to a user, so
//   callers that can hit one (inserts/updates on a unique column) pass
//   their own duplicateMessage; callers that can't (most RPC calls) just
//   omit it.
// - PGRST202 means PostgREST couldn't find the RPC/table the app just
//   called - the app's code has shipped ahead of a required migration.
// Anything else falls back to the raw message as-is.
//
// calls/actions.ts's migrationAwareMessage handles the same PGRST202 case
// but deliberately isn't merged into this: its callers render the
// returned string directly with no wrapping "Error:" label, so it needs
// an operation-specific prefix baked into the non-migration fallback too
// - every other caller here already gets that label from its own UI
// (e.g. `{dict.vehicles.error}: {saveError}`), so this fallback stays
// unprefixed. Both still share the same dict.common.migrationsNeeded text.
export function friendlyDbError(error: PostgresErrorLike, migrationsNeededMessage: string, duplicateMessage?: string): string {
  if (duplicateMessage && error.code === '23505') return duplicateMessage
  if (error.code === 'PGRST202') return migrationsNeededMessage
  return error.message
}
