import { NextResponse } from "next/server";
import { getMenuData } from "@/lib/menudata";
import { MAX_BYTES, WHICH, fromBible, isImageType, storageUrlOk, type Which } from "@/lib/passport/websitePhotos";

export const dynamic = "force-dynamic";

/**
 * File 14: one public menu picture, for the Bible's import tool (the Bible's key only). Only a picture the menu itself
 * points at, in the site's own Supabase Storage; no redirect is followed; images only; at most 15 MB.
 */
export async function GET(req: Request, { params }: { params: { id: string; which: string } }) {
  if (!fromBible(req)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(params.id) || !WHICH.includes(params.which as Which)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const { items } = await getMenuData();
  const it = items.find((x) => String(x.id) === params.id && x.active);
  const url = storageUrlOk(params.which === "carousel" ? it?.carouselImageUrl : it?.menuPageImageUrl);
  if (!url) return NextResponse.json({ error: "Not found" }, { status: 404 });
  let res: Response;
  try {
    res = await fetch(url, { redirect: "manual", cache: "no-store", signal: AbortSignal.timeout(15_000) });
  } catch {
    return NextResponse.json({ error: "Couldn't fetch that picture" }, { status: 502 });
  }
  if (!res.ok || !isImageType(res.headers.get("content-type"))) return NextResponse.json({ error: "Not a picture" }, { status: 502 });
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length > MAX_BYTES) return NextResponse.json({ error: "Too large" }, { status: 413 });
  return new NextResponse(buf, { headers: { "Content-Type": res.headers.get("content-type") || "image/jpeg", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });
}
