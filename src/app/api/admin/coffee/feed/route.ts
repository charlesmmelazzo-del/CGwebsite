import { NextResponse } from "next/server";
import { getCoffeeFeed } from "@/lib/coffee/feed";

/** Coffee 01: Toast's Coffee Shop menu as the Bible serves it, read fresh, for the coffee admin's live-menu settings. */
export const dynamic = "force-dynamic";

export async function GET() {
  const { feed, source } = await getCoffeeFeed({ force: true });
  return NextResponse.json({ feed, source }, { headers: { "Cache-Control": "no-store" } });
}
