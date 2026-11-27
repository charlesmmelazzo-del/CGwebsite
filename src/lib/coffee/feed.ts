import "server-only";
import { createHash } from "node:crypto";
import { unstable_noStore as noStore } from "next/cache";
import { getSupabaseAdmin } from "@/lib/supabase";
import { sanitizeFeed, type CoffeeFeed } from "./live";

/**
 * Coffee 01: the Bible's guest-safe Toast "Coffee Shop" feed (GET <BIBLE_API_URL>/api/public/coffee-menu, no key).
 *
 * Read at most every 10 minutes per server (REFRESH_MS). If the Bible can't be reached, the page keeps the last good
 * copy: first the one in memory, then the one saved in Supabase (coffee_menu_feed, written only when the menu
 * changes), so a deploy during a Bible outage still shows the menu. Never a blank page because of the feed.
 */

export const REFRESH_MS = 10 * 60 * 1000;
const RETRY_MS = 60 * 1000;
const TIMEOUT_MS = 5_000;

export type FeedSource = "bible" | "memory" | "saved" | "none";
interface Held { feed: CoffeeFeed | null; at: number; hash: string; source: FeedSource }
let held: Held | null = null;
let inflight: Promise<Held> | null = null;

function baseUrl(): string {
  return (process.env.BIBLE_API_URL || "https://cgbible.com").replace(/\/+$/, "");
}
const hashOf = (f: CoffeeFeed) => createHash("sha256").update(JSON.stringify(f)).digest("hex");

async function fromBible(): Promise<CoffeeFeed | null> {
  const res = await fetch(`${baseUrl()}/api/public/coffee-menu`, {
    headers: { Accept: "application/json" },
    cache: "no-store",
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`Bible answered ${res.status}`);
  return sanitizeFeed(await res.json());
}

async function fromSaved(): Promise<{ feed: CoffeeFeed; hash: string } | null> {
  try {
    const { data } = await getSupabaseAdmin().from("coffee_menu_feed").select("data, hash").eq("id", 1).maybeSingle();
    const feed = sanitizeFeed(data?.data);
    return feed ? { feed, hash: String(data?.hash ?? hashOf(feed)) } : null;
  } catch {
    return null;
  }
}

async function save(feed: CoffeeFeed, hash: string): Promise<void> {
  try {
    await getSupabaseAdmin().from("coffee_menu_feed").upsert({ id: 1, data: feed, hash, saved_at: new Date().toISOString() }, { onConflict: "id" });
  } catch (e) {
    console.error("[coffee] saving the last good menu failed:", e instanceof Error ? e.message : e);
  }
}

async function refresh(): Promise<Held> {
  try {
    const feed = await fromBible();
    if (!feed) throw new Error("not a coffee menu");
    const hash = hashOf(feed);
    if (!held || held.hash !== hash) {
      const saved = held ? null : await fromSaved();
      if (!saved || saved.hash !== hash) await save(feed, hash);
    }
    held = { feed, at: Date.now(), hash, source: "bible" };
  } catch (e) {
    console.error("[coffee] reading the menu from the Bible failed:", e instanceof Error ? e.message : e);
    if (held?.feed) {
      held = { ...held, at: Date.now() - REFRESH_MS + RETRY_MS, source: "memory" };
    } else {
      const saved = await fromSaved();
      held = saved
        ? { feed: saved.feed, at: Date.now() - REFRESH_MS + RETRY_MS, hash: saved.hash, source: "saved" }
        : { feed: null, at: Date.now() - REFRESH_MS + RETRY_MS, hash: "", source: "none" };
    }
  }
  return held;
}

/** The coffee feed (or null when there has never been one), and where it came from. force: skip the 10 minutes (admin). */
export async function getCoffeeFeed({ force = false }: { force?: boolean } = {}): Promise<{ feed: CoffeeFeed | null; source: FeedSource }> {
  noStore(); // rendered per request; this module keeps its own 10-minute copy
  if (!force && held && Date.now() - held.at < REFRESH_MS) return { feed: held.feed, source: held.source };
  if (!inflight) inflight = refresh().finally(() => { inflight = null; });
  const h = await inflight;
  return { feed: h.feed, source: h.source };
}
