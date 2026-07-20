import { cache } from 'react'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { env } from '@/lib/env'

// Every page/layout/lib-data function calls this independently - cache()
// dedupes those into a single client (and a single cookies() read) per
// request, the same treatment already given to lib/data/users.ts's
// getProfile().
export const createClient = cache(async () => {
  const cookieStore = await cookies()

  return createServerClient(
    env.supabaseUrl,
    env.supabaseAnonKey,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Server Component — cookies set in middleware instead
          }
        },
      },
    }
  )
})
