import { unstable_noStore as noStore } from "next/cache";
import { getSupabaseAdmin } from "./supabase";
import type { CarouselItem } from "@/types";

const DEFAULT_CAROUSEL: CarouselItem[] = [
  { id: "1", type: "text", order: 0, active: true, text: "Common Good is a cocktail house in the heart of Glen Ellyn, Illinois." },
  { id: "2", type: "text", order: 1, active: true, text: "Modern, classic, upscale, seasonal and sometimes whimsical cocktails." },
  { id: "3", type: "text", order: 2, active: true, text: "A space to celebrate life — from special occasions to day-to-day." },
];

export async function getHomeData(): Promise<{ bgUrl: string; carouselItems: CarouselItem[] }> {
  noStore();
  try {
    const sb = getSupabaseAdmin();
    const { data } = await sb.from("home_settings").select("*").eq("id", 1).single();
    if (!data) return { bgUrl: "", carouselItems: DEFAULT_CAROUSEL };
    return {
      bgUrl: data.bg_url ?? "",
      carouselItems: (data.carousel_items as CarouselItem[]) ?? DEFAULT_CAROUSEL,
    };
  } catch {
    return { bgUrl: "", carouselItems: DEFAULT_CAROUSEL };
  }
}
