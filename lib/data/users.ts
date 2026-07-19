import { createClient } from '@/lib/supabase/server'
import type { UserRole } from '@/types'

export interface Profile {
  name: string
  role: UserRole
  organization_id: string
}

export interface OrgMember {
  id: string
  name: string
  role: UserRole
}

export async function getUserOptions(): Promise<{ id: string; name: string }[]> {
  const supabase = await createClient()
  const { data } = await supabase.from('users').select('id, name').order('name')
  return data ?? []
}

export async function getOrgMembers(): Promise<OrgMember[]> {
  const supabase = await createClient()
  const { data } = await supabase.from('users').select('id, name, role').order('name')
  return data ?? []
}

export async function getProfile(userId: string): Promise<Profile | null> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('users')
    .select('name, role, organization_id')
    .eq('id', userId)
    .single()
  return data
}
