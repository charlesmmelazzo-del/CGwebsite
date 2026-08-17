import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/constants";

// Static list of public routes. Admin, API and the Pop Up Zone (/popup) are
// intentionally excluded — the zone is reached from the footer, not search.
export default function sitemap(): MetadataRoute.Sitemap {
  const routes = ["", "/menu", "/coffee", "/events", "/about", "/club", "/shop"];
  const lastModified = new Date();
  return routes.map((path) => ({
    url: `${SITE_URL}${path}`,
    lastModified,
    changeFrequency: path === "" ? "weekly" : "monthly",
    priority: path === "" ? 1 : 0.7,
  }));
}
