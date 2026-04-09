import { unstable_noStore as noStore } from "next/cache";
import { getSupabaseAdmin } from "./supabase";
import type { PageHeaderData } from "@/types";

// Default values used when no DB row exists yet
const DEFAULTS: Record<string, PageHeaderData> = {
  menu: {
    title: "Our Menu",
    titleSize: 72,
    subtitle: "Refreshing Seasonal Cocktails",
    subtitleSize: 13,
  },
  coffee: {
    title: "Coffee House",
    titleSize: 72,
    subtitle: "Whether you're grabbing something on the way to the Metra or need a nice place to work, read a book, or meet up with a friend — we've got you.",
    subtitleSize: 14,
  },
  events: {
    title: "Events",
    titleSize: 72,
    tabs: [
      { id: "upcoming", label: "Upcoming Events" },
      { id: "host", label: "Host Your Event" },
    ],
  },
  club: {
    title: "Club",
    titleSize: 72,
  },
  about: {
    title: "About",
    titleSize: 72,
  },
  shop: {
    title: "Shop",
    titleSize: 72,
    tabs: [
      { id: "bottles",      label: "Bottles & Merch" },
      { id: "cocktails",    label: "Cocktails To Go" },
      { id: "memberships",  label: "Memberships" },
      { id: "giftcards",    label: "Gift Cards" },
    ],
  },
};

export const PAGE_IDS = ["menu", "coffee", "events", "club", "about", "shop"] as const;
export type PageId = typeof PAGE_IDS[number];

export function getPageDefault(pageId: string): PageHeaderData {
  return DEFAULTS[pageId] ?? { title: pageId, titleSize: 72 };
}

/**
 * Fetch a single page's header config from Supabase, merged with defaults.
 * Called server-side in each page component.
 */
export async function getPageHeader(pageId: string): Promise<PageHeaderData> {
  noStore();
  const def = getPageDefault(pageId);
  try {
    const sb = getSupabaseAdmin();
    const { data } = await sb
      .from("page_headers")
      .select("data")
      .eq("page_id", pageId)
      .single();
    if (!data?.data) return def;
    // Merge: defaults first, then DB values on top (so new fields always have a fallback)
    return { ...def, ...(data.data as Partial<PageHeaderData>) };
  } catch {
    return def;
  }
}

/**
 * Fetch all page header configs at once (used by the admin page).
 */
export async function getAllPageHeaders(): Promise<Record<string, PageHeaderData>> {
  noStore();
  const result: Record<string, PageHeaderData> = {};
  // Start with all defaults
  for (const id of PAGE_IDS) {
    result[id] = { ...DEFAULTS[id] };
  }
  try {
    const sb = getSupabaseAdmin();
    const { data } = await sb.from("page_headers").select("page_id, data");
    for (const row of data ?? []) {
      if (row.page_id && result[row.page_id]) {
        result[row.page_id] = { ...result[row.page_id], ...(row.data as Partial<PageHeaderData>) };
      }
    }
  } catch {
    // Fall back to defaults
  }
  return result;
}
