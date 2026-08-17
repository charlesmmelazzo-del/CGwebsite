import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/constants";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // /popup is the Pop Up Zone — a members' area reached from the footer,
      // not something to surface in search. (Also noindex'd in its layout.)
      disallow: ["/admin", "/api", "/popup"],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
