import type { NextConfig } from "next";

// Next.js sets none of these by default. The app has no client-side fetch,
// no next/image, and no third-party scripts (see grep before adding this -
// everything is server-rendered, mutations go through Server Actions), so
// the policy below can be this strict without a nonce setup. 'unsafe-inline'
// on script/style is still needed for the framework's own hydration script
// and React's occasional inline `style` attribute.
const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ')

const nextConfig: NextConfig = {
  turbopack: {
    root: process.cwd(),
  },
  outputFileTracingRoot: process.cwd(),
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'Content-Security-Policy', value: CONTENT_SECURITY_POLICY },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          // Belt-and-suspenders alongside frame-ancestors above, for the
          // handful of older browsers that don't support CSP frame-ancestors.
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
        ],
      },
    ]
  },
  experimental: {
    serverActions: {
      // Default is 1MB, too tight for a real .xlsx inventory sheet (the
      // zip/XML format carries non-trivial fixed overhead even for a
      // few hundred rows) - see ImportExcelModal.tsx's matching
      // client-side size check, kept in sync with this value by hand.
      bodySizeLimit: '10mb',
    },
  },
};

export default nextConfig;
