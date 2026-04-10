import { unstable_noStore as noStore } from "next/cache";
import { getSupabaseAdmin } from "./supabase";

export interface CoffeeMenu {
  id: string;
  label: string;
  imageUrl: string | null;
  alt: string;
  order: number;
  active: boolean;
}

export async function getCoffeeMenus(): Promise<CoffeeMenu[]> {
  noStore();
  try {
    const sb = getSupabaseAdmin();
    const { data, error } = await sb
      .from("coffee_menus")
      .select("*")
      .eq("active", true)
      .order("order_num");

    if (error) throw error;

    return (data ?? []).map((r) => ({
      id: r.id,
      label: r.label,
      imageUrl: r.image_url,
      alt: r.alt ?? "",
      order: r.order_num,
      active: r.active,
    }));
  } catch {
    return [];
  }
}
