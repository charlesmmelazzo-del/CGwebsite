/**
 * Makes /passport installable to a phone's home screen as "Passport", opening
 * without browser bars. Scoped to /passport only; the rest of the site is unchanged.
 * Icons (file 16, Part 10): a small passport booklet with the Common Good mark on its cover, drawn once as
 * public/passport/icons/icon.svg (and icon-maskable.svg, the booklet inside the central 80% safe zone) and committed as
 * PNGs in public/passport/icons/. The old addresses (public/passport/icon-192.png and friends) hold the same pictures,
 * so a phone that installed Passport before keeps a matching icon.
 */
export const dynamic = "force-static";

export function GET() {
  return new Response(
    JSON.stringify({
      name: "Common Good Passport",
      short_name: "Passport",
      id: "/passport",
      start_url: "/passport",
      // Without a trailing slash, so the start page itself (/passport) is inside the app.
      scope: "/passport",
      display: "standalone",
      background_color: "#13170F",
      theme_color: "#13170F",
      icons: [
        { src: "/passport/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
        { src: "/passport/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
        { src: "/passport/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      ],
    }),
    { headers: { "Content-Type": "application/manifest+json", "Cache-Control": "public, max-age=3600" } },
  );
}
