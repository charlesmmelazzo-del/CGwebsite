import { unstable_noStore as noStore } from "next/cache";
import { getSupabaseAdmin } from "./supabase";
import type { SiteConfig, SiteSettings } from "@/types";
import { SITE_SETTINGS } from "./constants";

export const DEFAULT_SITE_CONFIG: SiteConfig = {
  header: {
    logoSize: 58,
    mobileLogoSize: 44,
    headerHeight: 72,
    mobileHeaderHeight: 52,
    bgColor: "#1A1F17",
    textColor: "#8A9A78",
    activeColor: "#C97D5A",
    borderColor: "#2a3020",
    navFontSize: 13,
    navLetterSpacing: "0.22em",
    navPaddingX: 20,
    navLinks: [
      { id: "nav-menu",   label: "Menu",   href: "/menu",   visible: true, order: 0 },
      { id: "nav-coffee", label: "Coffee", href: "/coffee", visible: true, order: 1 },
      { id: "nav-events", label: "Events", href: "/events", visible: true, order: 2 },
      { id: "nav-club",   label: "Club",   href: "/club",   visible: true, order: 3 },
      { id: "nav-shop",   label: "Shop",   href: "/shop",   visible: true, order: 4 },
      { id: "nav-about",  label: "About",  href: "/about",  visible: true, order: 5 },
    ],
  },
  footer: {
    bgColor: "#1A1F17",
    textColor: "#8A9A78",
    mutedColor: "#4a5a3a",
    showHours: true,
    showContact: true,
    showSocialLinks: true,
    copyrightText: "© 2025 Common Good Cocktail House",
  },
  updatedAt: new Date().toISOString(),
};

/**
 * Fetch site config from Supabase.
 * Called from the root layout (server component) on every request.
 * noStore() ensures Next.js never caches this — changes appear immediately.
 */
export async function getSiteConfig(): Promise<SiteConfig> {
  noStore();
  try {
    const sb = getSupabaseAdmin();
    const { data } = await sb.from("site_config").select("*").eq("id", 1).single();
    if (!data) return DEFAULT_SITE_CONFIG;
    return {
      header:    data.header    ?? DEFAULT_SITE_CONFIG.header,
      footer:    data.footer    ?? DEFAULT_SITE_CONFIG.footer,
      updatedAt: data.updated_at,
    };
  } catch {
    // If Supabase is unreachable (e.g. missing env vars locally), use defaults
    return DEFAULT_SITE_CONFIG;
  }
}

/**
 * Fetch site settings (phone, email, address, hours, social links) from Supabase.
 * Falls back to hardcoded constants if unavailable.
 */
export async function getSiteSettings(): Promise<SiteSettings> {
  noStore();
  try {
    const sb = getSupabaseAdmin();
    const { data } = await sb.from("site_settings").select("*").eq("id", 1).single();
    if (!data?.data) return { ...SITE_SETTINGS };
    return data.data as SiteSettings;
  } catch {
    return { ...SITE_SETTINGS };
  }
}
