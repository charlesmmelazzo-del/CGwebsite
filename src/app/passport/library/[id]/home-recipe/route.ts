import { NextResponse } from "next/server";
import { getHomeRecipe } from "@/lib/passport/bible";
import { currentAuth } from "@/lib/passport/session";

export const dynamic = "force-dynamic";

/**
 * File 03b: "Make it at home". The PDF comes from the Bible through the Passport connection, only for a signed-in
 * member, only when the bar switched it on. It is never at a public address and never cached.
 */
export async function GET(req: Request, { params }: { params: { id: string } }) {
  const id = Number(params.id);
  const auth = currentAuth();
  if (!auth) return NextResponse.redirect(new URL("/passport", req.url));
  if (!Number.isInteger(id) || id <= 0) return new NextResponse("Not found", { status: 404 });
  const res = await getHomeRecipe(auth, id);
  if (!res) return new NextResponse("Passport is unavailable right now. Please try again shortly.", { status: 503 });
  if (res.status === 401) return NextResponse.redirect(new URL("/passport", req.url));
  if (!res.ok) return new NextResponse("Not found", { status: res.status === 404 ? 404 : 503 });
  return new NextResponse(res.body, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": res.headers.get("content-disposition") || 'attachment; filename="At home.pdf"',
      "Cache-Control": "private, no-store",
    },
  });
}
