import { NextRequest, NextResponse } from "next/server";
import { getCoffeeMenus } from "@/lib/coffeedata";
import { getCoffeeFeed } from "@/lib/coffee/feed";
import { composeTabs } from "@/lib/coffee/live";
import { getIp, isRateLimited } from "@/lib/rateLimit";

/**
 * Coffee 01, Part B4: what the coffee page is showing, for the Bible's weekly rundown check
 * ("Website coffee menu matches Toast"). Public and read-only: the same names and prices guests see, per tab, and the
 * Toast items no tab shows with the reason. Nothing the page doesn't already show, apart from those reasons.
 */
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (isRateLimited("read", getIp(req))) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429, headers: { "Retry-After": "600" } });
  }
  const [menus, { feed, source }] = await Promise.all([getCoffeeMenus(), getCoffeeFeed()]);
  const { tabs, notShown } = composeTabs(
    menus.map((m) => ({ id: m.id, label: m.label, live: m.live, hasPdf: !!(m.pdfPages?.length || m.imageUrl) })),
    feed,
  );
  return NextResponse.json(
    {
      feed: { updated_at: feed?.updated_at ?? null, menu_read_at: feed?.menu_read_at ?? null, source },
      tabs: tabs.map((t) => ({
        label: t.label,
        showing: t.showing,
        sections: t.sections.map((s) => ({
          heading: s.heading,
          note: s.note,
          items: s.items.map((it) => ({ id: it.id, name: it.name, prices: it.prices, note: it.note })),
        })),
      })),
      not_shown: notShown,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
