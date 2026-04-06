import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import type { SiteConfig } from "@/types";

const DEFAULT_CONFIG: SiteConfig = {
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

async function readConfig(): Promise<SiteConfig> {
  const sb = getSupabaseAdmin();
  const { data } = await sb.from("site_config").select("*").eq("id", 1).single();
  if (!data) return DEFAULT_CONFIG;
  return {
    header:    data.header,
    footer:    data.footer,
    updatedAt: data.updated_at,
  };
}

// GET — return current site config
export async function GET() {
  try {
    return NextResponse.json(await readConfig());
  } catch (e) {
    console.error("[GET /api/admin/siteconfig]", e);
    return NextResponse.json(DEFAULT_CONFIG);
  }
}

// POST — update site config (partial merge)
export async function POST(req: NextRequest) {
  try {
    const sb = getSupabaseAdmin();
    const body = await req.json();
    const current = await readConfig();

    const updated: SiteConfig = {
      header: body.header ? { ...current.header, ...body.header } : current.header,
      footer: body.footer ? { ...current.footer, ...body.footer } : current.footer,
      updatedAt: new Date().toISOString(),
    };

    const { error } = await sb.from("site_config").upsert(
      {
        id:         1,
        header:     updated.header,
        footer:     updated.footer,
        updated_at: updated.updatedAt,
      },
      { onConflict: "id" }
    );

    if (error) throw error;
    return NextResponse.json({ success: true, config: updated });
  } catch (e) {
    console.error("[POST /api/admin/siteconfig]", e);
    return NextResponse.json({ success: false, error: String(e) }, { status: 500 });
  }
}
