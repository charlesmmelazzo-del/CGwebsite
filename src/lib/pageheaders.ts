import { unstable_noStore as noStore } from "next/cache";
import { getSupabaseAdmin } from "./supabase";
import type { PageHeaderData } from "@/types";
import { PAGE_DEFAULTS, getPageDefault } from "./pagedefaults";

export { getPageDefault };

export const PAGE_IDS = ["menu", "coffee", "events", "club", "about", "shop"] as const;
export type PageId = typeof PAGE_IDS[number];

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
    result[id] = { ...PAGE_DEFAULTS[id] };
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
