import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";

/**
 * File 14, Part 4: the public site's own cocktail photos, handed to the Bible's "Bring in photos from the website" tool.
 *
 * Where they live: the public menu (src/app/menu) reads Supabase table `menu_items` (lib/menudata.ts). Each menu
 * cocktail has a title and up to two pictures in Supabase Storage: `carousel_image_url` (the photo in the menu's
 * carousel) and `menu_page_image_url` (the picture on its menu page). Nothing else ties a photo to a cocktail: the
 * Bible matches by the title.
 *
 * Both routes answer only the Bible (the Passport sync key, the same key the website already uses to reach the
 * Bible), so they add no new public door; and the picture route fetches only a picture the menu itself points at, in
 * the site's own Supabase Storage (public objects), never an address from the request.
 */
export const WHICH = ["carousel", "menu_page"] as const;
export type Which = (typeof WHICH)[number];
export const MAX_BYTES = 15 * 1024 * 1024;
const IMAGE = /^image\/(jpeg|jpg|png|webp)\b/i;

/** The Bible's Bearer key, compared in constant time. */
export function fromBible(req: Request): boolean {
  const key = process.env.PASSPORT_SYNC_KEY || "";
  const got = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (key.length < 24 || !got) return false;
  const a = createHash("sha256").update(key).digest();
  const b = createHash("sha256").update(got).digest();
  return timingSafeEqual(a, b);
}

/** A picture address the site may fetch: https, the site's own Supabase project, a public Storage object. */
export function storageUrlOk(raw: string | null | undefined): URL | null {
  if (!raw) return null;
  let u: URL;
  try { u = new URL(raw); } catch { return null; }
  if (u.protocol !== "https:" || u.username || u.password || u.port) return null;
  if (!/^[a-z0-9-]+\.supabase\.co$/i.test(u.hostname)) return null;
  const own = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (own) { try { if (new URL(own).hostname !== u.hostname) return null; } catch { return null; } }
  if (!u.pathname.startsWith("/storage/v1/object/public/") || u.pathname.includes("..")) return null;
  return u;
}

export const isImageType = (t: string | null) => IMAGE.test(t || "");

export interface WebsitePhoto { key: string; name: string; menu: string; path: string }

/** One entry per picture: "<item id>/<which>", the title, the menu tab's label, and the path the Bible may fetch. */
export function photoList(items: { id: string; tabId: string; title: string; active: boolean; carouselImageUrl?: string; menuPageImageUrl?: string }[], tabs: { id: string; label: string; active: boolean }[]): WebsitePhoto[] {
  const tabName = new Map(tabs.map((t) => [t.id, t]));
  const out: WebsitePhoto[] = [];
  for (const it of items) {
    if (!it.active || !it.title || !/^[A-Za-z0-9_-]{1,64}$/.test(String(it.id))) continue;
    const tab = tabName.get(it.tabId);
    if (tab && !tab.active) continue;
    const pics: [Which, string | undefined][] = [["carousel", it.carouselImageUrl], ["menu_page", it.menuPageImageUrl]];
    for (const [which, url] of pics) {
      if (!storageUrlOk(url)) continue;
      const key = `${it.id}/${which}`;
      out.push({ key, name: it.title.trim(), menu: tab?.label || "", path: `/api/passport/website-photos/${key}` });
    }
  }
  return out;
}
