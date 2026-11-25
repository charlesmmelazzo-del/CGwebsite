import { tabPage } from "@/lib/passport/tabPage";

export const dynamic = "force-dynamic";

/**
 * File 06: the Index tab, at the Library's old address (so every Library link still lands here). The app frame draws
 * it; an old ?q= or ?spirit= fills the search box or the filter. This address only checks sign-in.
 */
export default function IndexRoute() {
  return tabPage();
}
