import { unstable_noStore as noStore } from "next/cache";
import { getSupabaseAdmin } from "./supabase";
import type { MenuTab, MenuItem } from "@/types";

export interface CoffeeData {
  tabs: MenuTab[];
  items: MenuItem[];
}

export async function getCoffeeData(): Promise<CoffeeData> {
  noStore();
  try {
    const sb = getSupabaseAdmin();
    const [tabsRes, itemsRes] = await Promise.all([
      sb.from("coffee_tabs").select("*").order("order"),
      sb.from("coffee_items").select("*").order("order"),
    ]);
    const tabs: MenuTab[] = (tabsRes.data ?? []).map((r) => ({
      id: r.id,
      label: r.label,
      order: r.order,
      active: r.active,
    }));
    const items: MenuItem[] = (itemsRes.data ?? []).map((r) => ({
      id: r.id,
      tabId: r.tab_id,
      title: r.title,
      description: r.description ?? undefined,
      price: r.price ?? undefined,
      carouselImageUrl: r.carousel_image_url ?? undefined,
      menuPageImageUrl: r.menu_page_image_url ?? undefined,
      alt: r.alt ?? undefined,
      tagLine: r.tag_line ?? undefined,
      ingredients: r.ingredients ?? undefined,
      tastingNotes: r.tasting_notes ?? undefined,
      notableNotes: r.notable_notes ?? undefined,
      order: r.order,
      active: r.active,
      titleColor: r.title_color ?? undefined,
      descriptionColor: r.description_color ?? undefined,
      priceColor: r.price_color ?? undefined,
    }));
    return { tabs, items };
  } catch {
    return { tabs: [], items: [] };
  }
}
