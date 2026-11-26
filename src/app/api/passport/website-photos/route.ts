import { NextResponse } from "next/server";
import { getMenuData } from "@/lib/menudata";
import { fromBible, photoList } from "@/lib/passport/websitePhotos";

export const dynamic = "force-dynamic";

/** File 14: the public menu's cocktail photos, listed for the Bible's import tool (the Bible's key only). */
export async function GET(req: Request) {
  if (!fromBible(req)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const { tabs, items } = await getMenuData();
  return NextResponse.json({ photos: photoList(items, tabs) }, { headers: { "Cache-Control": "no-store" } });
}
