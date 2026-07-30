import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { hasLocale, locales, type Locale } from '@/app/[lang]/dictionaries'

const defaultLocale: Locale = 'en'

function detectLocale(request: NextRequest): Locale {
  const cookieLocale = request.cookies.get('locale')?.value
  if (cookieLocale && hasLocale(cookieLocale)) return cookieLocale

  const acceptLanguage = request.headers.get('accept-language') ?? ''
  if (acceptLanguage.toLowerCase().includes('uk')) return 'uk'
  return defaultLocale
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  const pathnameLocale = locales.find(
    (locale) => pathname === `/${locale}` || pathname.startsWith(`/${locale}/`)
  )

  if (!pathnameLocale) {
    const locale = detectLocale(request)
    const url = request.nextUrl.clone()
    url.pathname = `/${locale}${pathname}`
    return NextResponse.redirect(url)
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  // Skip auth check if Supabase is not configured yet
  if (!supabaseUrl || supabaseUrl === 'your_supabase_project_url') {
    return NextResponse.next({ request })
  }

  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(supabaseUrl, supabaseKey!, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value)
        )
        supabaseResponse = NextResponse.next({ request })
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options)
        )
      },
    },
  })

  const { data: claimsData } = await supabase.auth.getClaims()
  const isAuthenticated = Boolean(claimsData?.claims.sub)

  const rest = pathname.slice(`/${pathnameLocale}`.length) || '/'
  const isLoginPage = rest === '/login'
  const isPublic = isLoginPage || rest === '/'

  if (!isAuthenticated && !isPublic) {
    return NextResponse.redirect(new URL(`/${pathnameLocale}/login`, request.url))
  }

  if (isAuthenticated && isLoginPage) {
    return NextResponse.redirect(new URL(`/${pathnameLocale}/dashboard`, request.url))
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
