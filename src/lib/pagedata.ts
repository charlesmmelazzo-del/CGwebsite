import { unstable_noStore as noStore } from "next/cache";
import { getSupabaseAdmin } from "./supabase";
import type { ContentSection } from "@/types";

export interface ShopTab {
  id: string;
  label: string;
  body: string;
  buttonLabel: string;
  buttonUrl: string;
  buttonNewTab: boolean;
}

export const DEFAULT_ABOUT: ContentSection[] = [
  {
    id: "about-1", order: 0,
    title: "Our Story",
    body: "Common Good Cocktail House is an extension of our living room, where you experience genuine, heartfelt hospitality. We want to share things we love with you, and we want to facilitate connection and community at our table.\n\nEveryone is welcome through our doors to discover, taste, and have a good time.",
  },
  {
    id: "about-2", order: 1,
    title: "What We Do",
    body: "We make modern, classic, upscale, seasonal and sometimes whimsical cocktails using fun techniques in a beautiful but low-key, friendly environment.\n\nWe want to make the best cocktails you've ever tasted. But, most of all, we want to create a space to celebrate life, from special occasions to day-to-day.",
  },
];

export const DEFAULT_CLUB: ContentSection[] = [
  {
    id: "club-1", order: 0,
    title: "Common Good Cocktail Club",
    body: "When you subscribe to Common Good Cocktail House you'll unlock exclusive access to our fun and delicious cocktails and our expansive and exclusive spirits cellar.\n\nThink monthly boxes of favorite and classic cocktails and spirits, and priority access to reserve and rare bottles.",
    buttonLabel: "Find Out More & Join",
    buttonUrl: "https://commongoodcocktailhouse.com/cocktailclub",
    buttonNewTab: true,
  },
];

export const DEFAULT_SHOP_TABS: ShopTab[] = [
  { id: "bottles",     label: "Bottles & Merch",      body: "Bring the Common Good experience home. Shop our curated selection of spirits, mixers, and merchandise.",                                                          buttonLabel: "Shop Now",              buttonUrl: "https://commongoodcocktailhouse.com/shop", buttonNewTab: true },
  { id: "cocktails",   label: "Cocktails To Go",       body: "Order online to bring the Common Good experience anywhere! To go cocktails, spirits, mixers, and more are available for pickup and delivery.",                   buttonLabel: "Shop To Go Cocktails",  buttonUrl: "https://commongoodcocktailhouse.com/shop", buttonNewTab: true },
  { id: "memberships", label: "Memberships & Spirits", body: "Unlock exclusive access with a Common Good membership. Priority access to reserve and rare bottles, exclusive spirits cellar, and more.",                        buttonLabel: "Memberships & Spirits", buttonUrl: "https://commongoodcocktailhouse.com/shop", buttonNewTab: true },
  { id: "giftcards",   label: "Gift Cards",            body: "Give the gift of Common Good. Perfect for any occasion.",                                                                                                          buttonLabel: "Buy a Gift Card",       buttonUrl: "https://commongoodcocktailhouse.com/shop", buttonNewTab: true },
];

async function loadSections<T>(slug: string): Promise<T[] | null> {
  noStore();
  try {
    const sb = getSupabaseAdmin();
    const { data } = await sb
      .from("pages")
      .select("sections")
      .eq("slug", slug)
      .maybeSingle();
    if (!data?.sections || !Array.isArray(data.sections) || data.sections.length === 0) return null;
    return data.sections as T[];
  } catch {
    return null;
  }
}

export async function getAboutSections(): Promise<ContentSection[]> {
  return (await loadSections<ContentSection>("about")) ?? DEFAULT_ABOUT;
}

export async function getClubSections(): Promise<ContentSection[]> {
  return (await loadSections<ContentSection>("club")) ?? DEFAULT_CLUB;
}

export async function getShopTabs(): Promise<ShopTab[]> {
  return (await loadSections<ShopTab>("shop")) ?? DEFAULT_SHOP_TABS;
}
