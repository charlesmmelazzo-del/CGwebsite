import type { HeaderConfig, NavLink } from "@/types";

/** The Reserve nav link added with guest reservations. */
export const RESERVE_NAV_LINK: NavLink = { id: "nav-reserve", label: "Reserve", href: "/reserve", visible: true, order: 3 };

const isReserve = (l: NavLink) => l.href.replace(/\/+$/, "") === "/reserve";

/**
 * Saved site configs predate the Reserve link. Append it when no link points at
 * /reserve, so it shows up in Header & Nav where an admin can move or hide it.
 */
export function withReserveLink(header: HeaderConfig): HeaderConfig {
  const links = header.navLinks ?? [];
  if (links.some(isReserve)) return header;
  const order = links.reduce((m, l) => Math.max(m, l.order), -1) + 1;
  return { ...header, navLinks: [...links, { ...RESERVE_NAV_LINK, order }] };
}

/** Drop any /reserve link while the feature is switched off. */
export function withoutReserveLink(header: HeaderConfig): HeaderConfig {
  return { ...header, navLinks: (header.navLinks ?? []).filter((l) => !isReserve(l)) };
}
