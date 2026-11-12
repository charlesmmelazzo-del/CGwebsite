import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/constants";
import { reserveEnabled } from "@/lib/reserve/enabled";

// Read RESERVE_ENABLED per request, not once at build time.
export const dynamic = "force-dynamic";

// Static list of public routes. Admin, API and the Pop Up Zone (/popup) are
// intentionally excluded — the zone is reached from the footer, not search.
export default function sitemap(): MetadataRoute.Sitemap {
  const routes = ["", "/menu", "/coffee", "/events", "/about", "/club", "/shop"];
  // Left out until reservations launch on this copy of the site.
  if (reserveEnabled()) routes.push("/reserve");
  const lastModified = new Date();
  return routes.map((path) => ({
    url: `${SITE_URL}${path}`,
    lastModified,
    changeFrequency: path === "" ? "weekly" : "monthly",
    priority: path === "" ? 1 : 0.7,
  }));
}
