import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { hasLocale, locales, type Locale } from '@/app/[lang]/dictionaries'

// Only handles 'invite' - the sole flow this app sends emails for (see
// (admin)/invite/actions.ts). Not a generic OTP-type passthrough: accepting
// whatever `type` the query string names would let it double as an
// unintended entry point for flows (password recovery, email change, ...)
// this app never asked Supabase to send.
export async function GET(request: NextRequest, { params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params
  const safeLang: Locale = hasLocale(lang) ? lang : locales[0]

  const { searchParams } = new URL(request.url)
  const tokenHash = searchParams.get('token_hash')
  const type = searchParams.get('type')

  if (tokenHash && type === 'invite') {
    const supabase = await createClient()
    const { error } = await supabase.auth.verifyOtp({ type: 'invite', token_hash: tokenHash })
    if (!error) {
      return NextResponse.redirect(new URL(`/${safeLang}/set-password`, request.url))
    }
  }

  return NextResponse.redirect(new URL(`/${safeLang}/login?error=invite_expired`, request.url))
}
