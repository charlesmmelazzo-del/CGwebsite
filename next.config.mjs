/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      // Supabase Storage (all projects use *.supabase.co)
      {
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
      // Allow localhost Supabase (local dev / Supabase CLI)
      {
        protocol: "http",
        hostname: "localhost",
        pathname: "/storage/v1/object/public/**",
      },
      // Common stock photo / CDN sources
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "res.cloudinary.com" },
      { protocol: "https", hostname: "imagedelivery.net" },
    ],
  },

  async headers() {
    return [
      {
        // Apply security headers to every route
        source: "/(.*)",
        headers: [
          // Prevent clickjacking
          { key: "X-Frame-Options",        value: "SAMEORIGIN" },
          // Stop browsers from MIME-sniffing
          { key: "X-Content-Type-Options", value: "nosniff" },
          // Enforce HTTPS
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
          // Control referrer info sent to third parties
          { key: "Referrer-Policy",        value: "strict-origin-when-cross-origin" },
          // Restrict browser features
          { key: "Permissions-Policy",     value: "camera=(), microphone=(), geolocation=()" },
          // Content Security Policy — defense-in-depth against XSS/injection.
          // Shipped as Report-Only so it logs violations to the browser console
          // WITHOUT blocking anything (avoids breaking Google Fonts, framer-motion
          // inline styles, or Next.js inline bootstrap scripts). Once the console
          // is clean in production, rename this key to "Content-Security-Policy"
          // to enforce it.
          { key: "Content-Security-Policy-Report-Only", value: CSP },
        ],
      },
    ];
  },
};

// Image/connect sources mirror the `images.remotePatterns` allowlist above.
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com data:",
  "img-src 'self' data: blob: https://*.supabase.co https://images.unsplash.com https://res.cloudinary.com https://imagedelivery.net",
  "connect-src 'self' https://*.supabase.co",
  "frame-ancestors 'self'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join("; ");

export default nextConfig;
