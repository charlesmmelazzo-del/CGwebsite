import { NextRequest, NextResponse } from "next/server";
import { getViewer } from "@/lib/popup/auth";
import { getMenuById } from "@/lib/popup/menus";
import { getAccess } from "@/lib/popup/tickets";

/**
 * GET — which games the signed-in guest has unlocked on a pop-up, and how many
 * High Score Runs they have left on each. Empty for a guest who isn't signed in.
 */
export async function GET(req: NextRequest) {
  const viewer = await getViewer();
  if (!viewer) return NextResponse.json({ access: {} });

  const menu = await getMenuById(req.nextUrl.searchParams.get("menuId") ?? "");
  if (!menu) return NextResponse.json({ error: "That pop-up doesn't exist." }, { status: 404 });

  try {
    return NextResponse.json({ access: await getAccess(menu.id, viewer.userId) });
  } catch (e) {
    console.error("[GET /api/popup/access]", e);
    return NextResponse.json({ access: {}, error: "Could not check your tickets." }, { status: 500 });
  }
}
