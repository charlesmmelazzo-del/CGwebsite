import type { PageHeaderData } from "@/types";

export const PAGE_DEFAULTS: Record<string, PageHeaderData> = {
  menu: {
    title: "Our Menu",
    titleSize: 72,
    subtitle: "Refreshing Seasonal Cocktails",
    subtitleSize: 13,
    theme: "terracotta",
  },
  coffee: {
    title: "Coffee House",
    titleSize: 72,
    subtitle: "Whether you're grabbing something on the way to the Metra or need a nice place to work, read a book, or meet up with a friend — we've got you.",
    subtitleSize: 14,
    theme: "olive",
  },
  events: {
    title: "Events",
    titleSize: 72,
    tabs: [
      { id: "upcoming", label: "Upcoming Events" },
      { id: "host", label: "Host Your Event" },
    ],
    theme: "green",
  },
  club: {
    title: "Club",
    titleSize: 72,
    theme: "plum",
  },
  about: {
    title: "About",
    titleSize: 72,
    theme: "blue",
  },
  shop: {
    title: "Shop",
    titleSize: 72,
    tabs: [
      { id: "bottles",     label: "Bottles & Merch" },
      { id: "cocktails",   label: "Cocktails To Go" },
      { id: "memberships", label: "Memberships" },
      { id: "giftcards",   label: "Gift Cards" },
    ],
    theme: "teal",
  },
};

export function getPageDefault(pageId: string): PageHeaderData {
  return PAGE_DEFAULTS[pageId] ?? { title: pageId, titleSize: 72 };
}
