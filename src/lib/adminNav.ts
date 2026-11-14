import {
  Home, UtensilsCrossed, Coffee, Calendar, CalendarCheck, Users, ShoppingBag,
  BookOpen, Sparkles, Settings, type LucideIcon,
} from "lucide-react";

/**
 * The admin's information architecture, in one place.
 *
 * Every page of the website gets one PANEL in the sidebar. Everything needed
 * to change that page — content, header, colours, related tools — lives in
 * the panel's TABS. Site-wide things live in the single "General Settings"
 * panel. The sidebar, the tab bar and the dashboard are all drawn from this.
 */
export type AdminTab = { href: string; label: string };

export type AdminPanel = {
  key: string;
  label: string;
  icon: LucideIcon;
  desc: string;         // one line for the dashboard card
  publicHref?: string;  // "View page" link
  tabs: AdminTab[];     // first tab is the panel's landing page
};

export const PAGE_PANELS: AdminPanel[] = [
  {
    key: "home", label: "Home", icon: Home, publicHref: "/",
    desc: "Carousel slides, background and colours",
    tabs: [
      { href: "/admin/home",       label: "Slides & Content" },
      { href: "/admin/home/style", label: "Background & Style" },
    ],
  },
  {
    key: "menu", label: "Menu", icon: UtensilsCrossed, publicHref: "/menu",
    desc: "Cocktail menu tabs and items, header and colours",
    tabs: [
      { href: "/admin/menu",       label: "Menu Items" },
      { href: "/admin/menu/style", label: "Header & Style" },
    ],
  },
  {
    key: "coffee", label: "Coffee", icon: Coffee, publicHref: "/coffee",
    desc: "Coffee menus and images, header and colours",
    tabs: [
      { href: "/admin/coffee",       label: "Coffee Menus" },
      { href: "/admin/coffee/style", label: "Header & Style" },
    ],
  },
  {
    key: "events", label: "Events", icon: Calendar, publicHref: "/events",
    desc: "Calendar, Host Your Event tab, competitions, colours",
    tabs: [
      { href: "/admin/events",       label: "Calendar" },
      { href: "/admin/events/host",  label: "Host Your Event" },
      { href: "/admin/competitions", label: "Competitions" },
      { href: "/admin/events/style", label: "Header & Style" },
    ],
  },
  {
    key: "reserve", label: "Reserve", icon: CalendarCheck, publicHref: "/reserve",
    desc: "Intro, photo, FAQ and colours",
    tabs: [
      { href: "/admin/reserve",       label: "Content" },
      { href: "/admin/reserve/style", label: "Background & Style" },
    ],
  },
  {
    key: "club", label: "Club", icon: Users, publicHref: "/club",
    desc: "Club page sections, header and colours",
    tabs: [
      { href: "/admin/club",       label: "Content" },
      { href: "/admin/club/style", label: "Header & Style" },
    ],
  },
  {
    key: "shop", label: "Shop", icon: ShoppingBag, publicHref: "/shop",
    desc: "Shop tabs and buttons, header and colours",
    tabs: [
      { href: "/admin/shop",       label: "Shop Tabs" },
      { href: "/admin/shop/style", label: "Header & Style" },
    ],
  },
  {
    key: "about", label: "About", icon: BookOpen, publicHref: "/about",
    desc: "About page sections, header and colours",
    tabs: [
      { href: "/admin/about",       label: "Content" },
      { href: "/admin/about/style", label: "Header & Style" },
    ],
  },
  {
    key: "popup", label: "Pop Ups", icon: Sparkles, publicHref: "/popup",
    desc: "Pop-up menus, guest accounts and the email list",
    tabs: [
      { href: "/admin/popup",        label: "Pop Ups" },
      { href: "/admin/popup/guests", label: "Guest Accounts" },
      { href: "/admin/marketing",    label: "Email List" },
    ],
  },
];

export const GENERAL_PANEL: AdminPanel = {
  key: "general", label: "General Settings", icon: Settings,
  desc: "Business info, header & footer, fonts, content library, form inbox",
  tabs: [
    { href: "/admin/settings", label: "Business Info" },
    { href: "/admin/header",   label: "Header & Footer" },
    { href: "/admin/fonts",    label: "Fonts" },
    { href: "/admin/images",   label: "Content Library" },
    { href: "/admin/forms",    label: "Form Inbox" },
    { href: "/admin/pages",    label: "Custom Pages" },
  ],
};

export const ALL_PANELS: AdminPanel[] = [...PAGE_PANELS, GENERAL_PANEL];

function matches(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(href + "/");
}

/** The panel + tab a URL belongs to (longest matching tab wins). */
export function findPanel(pathname: string): { panel: AdminPanel; tab: AdminTab } | null {
  let best: { panel: AdminPanel; tab: AdminTab } | null = null;
  for (const panel of ALL_PANELS) {
    for (const tab of panel.tabs) {
      if (matches(pathname, tab.href) && (!best || tab.href.length > best.tab.href.length)) {
        best = { panel, tab };
      }
    }
  }
  return best;
}
