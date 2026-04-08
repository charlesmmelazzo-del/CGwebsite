import { NextRequest, NextResponse } from "next/server";

const FB_OEMBED = "https://graph.facebook.com/v18.0/instagram_oembed";

// Valid Instagram post / reel / TV URL
function isValidInstagramUrl(url: string): boolean {
  return /^https?:\/\/(www\.)?instagram\.com\/(p|reel|tv)\/[\w-]+/.test(url);
}

// ── Strategy 1: Facebook oEmbed API (requires META_OEMBED_TOKEN env var) ──────
async function fetchViaOEmbed(url: string): Promise<{ imageUrl: string; caption: string } | null> {
  const token = process.env.META_OEMBED_TOKEN;
  if (!token) return null;

  try {
    const endpoint = `${FB_OEMBED}?url=${encodeURIComponent(url)}&access_token=${token}&fields=thumbnail_url,title&omitscript=true`;
    const res = await fetch(endpoint, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.thumbnail_url) return null;
    return { imageUrl: data.thumbnail_url, caption: data.title ?? "" };
  } catch {
    return null;
  }
}

// ── Strategy 2: OpenGraph scrape from the public post page ────────────────────
// Works for public posts without any API credentials.
async function fetchViaOpenGraph(url: string): Promise<{ imageUrl: string; caption: string } | null> {
  try {
    // Use a Googlebot-like UA so Instagram's SSR renders meta tags
    const res = await fetch(url, {
      headers: {
        "User-Agent":      "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
        "Accept":          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Cache-Control":   "no-cache",
      },
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) return null;
    const html = await res.text();

    // og:image — try both attribute orderings
    const ogImage =
      html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i)?.[1] ??
      html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:image["']/i)?.[1] ??
      "";

    if (!ogImage) return null;

    // og:description — caption / alt text for the post
    const rawDesc =
      html.match(/<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']+)["']/i)?.[1] ??
      html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:description["']/i)?.[1] ??
      "";

    // Decode common HTML entities
    const caption = rawDesc
      .replace(/&#(\d+);/g,  (_, n: string) => String.fromCharCode(parseInt(n)))
      .replace(/&amp;/g,  "&")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g,  "'")
      .replace(/&lt;/g,   "<")
      .replace(/&gt;/g,   ">");

    return { imageUrl: ogImage, caption };
  } catch {
    return null;
  }
}

// ── POST /api/admin/instagram ─────────────────────────────────────────────────
// Body: { url: string }
// Returns: { success, imageUrl, caption, fetchedAt } | { success: false, error }
export async function POST(req: NextRequest) {
  try {
    const { url } = await req.json();

    if (!url || typeof url !== "string") {
      return NextResponse.json({ success: false, error: "url is required" }, { status: 400 });
    }

    const trimmed = url.trim();
    if (!isValidInstagramUrl(trimmed)) {
      return NextResponse.json(
        { success: false, error: "URL must be a public Instagram post or reel link (e.g. https://www.instagram.com/p/ABC123/)" },
        { status: 400 }
      );
    }

    // Try oEmbed first (accurate, fast) — requires META_OEMBED_TOKEN
    let result = await fetchViaOEmbed(trimmed);

    // Fall back to OpenGraph scraping (no token needed)
    if (!result) {
      result = await fetchViaOpenGraph(trimmed);
    }

    if (!result || !result.imageUrl) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Could not fetch this post. It may be private, deleted, or temporarily unavailable. " +
            (process.env.META_OEMBED_TOKEN
              ? "The oEmbed token was tried but failed."
              : "Add a META_OEMBED_TOKEN env var for more reliable fetching."),
        },
        { status: 422 }
      );
    }

    return NextResponse.json({
      success:   true,
      imageUrl:  result.imageUrl,
      caption:   result.caption,
      fetchedAt: new Date().toISOString(),
    });
  } catch (e) {
    console.error("[POST /api/admin/instagram]", e);
    return NextResponse.json({ success: false, error: String(e) }, { status: 500 });
  }
}
