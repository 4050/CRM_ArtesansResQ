import { createClient } from '@/lib/supabase/server'

export interface Profile {
  name: string
  role: 'admin' | 'medic'
  organization_id: string
}

export async function getUserOptions(): Promise<{ id: string; name: string }[]> {
  const supabase = await createClient()
  const { data } = await supabase.from('users').select('id, name').order('name')
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
