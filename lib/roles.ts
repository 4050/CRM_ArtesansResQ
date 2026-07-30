import type { UserRole } from '@/types'

// master_admin has every admin capability plus user-role management (see
// supabase/schema.sql's is_admin()/is_master_admin() — the same widening
// is mirrored here so app-layer checks agree with the DB-layer ones).
export function isAdminRole(role: UserRole | null | undefined): boolean {
  return role === 'admin' || role === 'master_admin'
}

export function isMasterAdmin(role: UserRole | null | undefined): boolean {
  return role === 'master_admin'
}
