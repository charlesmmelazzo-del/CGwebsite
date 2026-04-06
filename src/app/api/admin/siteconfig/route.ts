import { NextRequest, NextResponse } from "next/server";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import path from "path";
import type { SiteConfig } from "@/types";

const DATA_DIR  = path.join(process.cwd(), "data");
const DATA_FILE = path.join(DATA_DIR, "siteconfig.json");

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

function readData(): SiteConfig {
  if (!existsSync(DATA_FILE)) return DEFAULT_CONFIG;
  return JSON.parse(readFileSync(DATA_FILE, "utf-8"));
}

function writeData(data: SiteConfig) {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

// GET — return current site config
export async function GET() {
  return NextResponse.json(readData());
}

// POST — update site config (partial merge)
export async function POST(req: NextRequest) {
  const body = await req.json();
  const current = readData();
  const updated: SiteConfig = {
    ...current,
    ...body,
    header: body.header ? { ...current.header, ...body.header } : current.header,
    footer: body.footer ? { ...current.footer, ...body.footer } : current.footer,
    updatedAt: new Date().toISOString(),
  };
  writeData(updated);
  return NextResponse.json({ success: true, config: updated });
}
