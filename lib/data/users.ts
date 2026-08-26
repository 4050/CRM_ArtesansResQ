import { cache } from 'react'
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
  is_active: boolean
}

export async function getUserOptions(): Promise<{ id: string; name: string }[]> {
  const supabase = await createClient()
  const { data, error } = await supabase.from('users').select('id, name').order('name')
  if (error) throw new Error(error.message)
  return data ?? []
}

export async function getOrgMembers(): Promise<OrgMember[]> {
  const supabase = await createClient()
  const { data, error } = await supabase.from('users').select('id, name, role, is_active').order('name')
  if (error) throw new Error(error.message)
  return data ?? []
}

export const getProfile = cache(async (userId: string): Promise<Profile | null> => {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('users')
    .select('name, role, organization_id')
    .eq('id', userId)
    .single()
  // PGRST116 ("no rows") is a legitimate "no profile yet" case callers
  // already handle by falling back to defaults - only a real DB error
  // should throw.
  if (error && error.code !== 'PGRST116') throw new Error(error.message)
  return data
})
