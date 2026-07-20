// Fails with a clear, actionable message at the point of use instead of
// the opaque error a bare `process.env.X!` non-null assertion produces
// once something downstream (createServerClient, etc.) chokes on
// `undefined`. Deliberately does not touch proxy.ts's own env check -
// that one intentionally lets unconfigured local dev requests through
// without redirecting to login, which is a different, non-throwing need.
function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}. Set it in .env.local (see README's "Environment variables" section).`)
  }
  return value
}

export const env = {
  get supabaseUrl() {
    return requireEnv('NEXT_PUBLIC_SUPABASE_URL')
  },
  get supabaseAnonKey() {
    return requireEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY')
  },
}
