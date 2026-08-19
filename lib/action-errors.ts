export interface PostgresErrorLike {
  code?: string
  message: string
}

// A unique-violation error's message names the underlying Postgres
// constraint (e.g. "consumables_organization_id_code_key"), which is
// meaningless to an end user and leaks schema detail they have no business
// seeing. Map that one common, well-known case to a friendly message -
// same "handle the known case, fall back to the raw message otherwise"
// shape as calls/actions.ts's migrationAwareMessage.
export function friendlyDbError(error: PostgresErrorLike, duplicateMessage: string): string {
  return error.code === '23505' ? duplicateMessage : error.message
}
