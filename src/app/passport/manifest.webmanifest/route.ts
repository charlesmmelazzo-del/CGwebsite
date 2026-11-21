/**
 * Makes /passport installable to a phone's home screen as "Passport", opening
 * without browser bars. Scoped to /passport only; the rest of the site is unchanged.
 * Icons: public/passport/icon-192.png, icon-512.png and apple-touch-icon.png
 * (placeholders until the final icon is designed; replace the files to change them).
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
        { src: "/passport/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
        { src: "/passport/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
        { src: "/passport/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      ],
    }),
    { headers: { "Content-Type": "application/manifest+json", "Cache-Control": "public, max-age=3600" } },
  );
}
