import type { SiteSettings } from "@/types";

export const SITE_SETTINGS: SiteSettings = {
  phone: "630-474-0932",
  email: "info@commongoodcocktailhouse.com",
  address: "560 Crescent Blvd.",
  addressLine2: "Glen Ellyn, IL 60137",
  hours: [
    {
      label: "COFFEE",
      lines: ["Mon - Sat  |  7am - 12pm"],
    },
    {
      label: "COCKTAILS",
      lines: [
        "Mon - Thurs  |  5pm - 11pm",
        "Fri - Sat  |  12pm - 1am",
        "Sunday: closed",
      ],
    },
  ],
  socialLinks: [
    { label: "Instagram", url: "https://instagram.com/commongoodcocktailhouse" },
  ],
};

export const NAV_LINKS = [
  { label: "ABOUT", href: "/about" },
  { label: "CLUB", href: "/club" },
  { label: "SHOP", href: "/shop" },
  { label: "EVENTS", href: "/events" },
  { label: "MENU", href: "/menu" },
  { label: "COFFEE", href: "/coffee" },
];
