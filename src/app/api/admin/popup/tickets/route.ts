import { NextRequest, NextResponse } from "next/server";
import { getCocktails, getMenuById } from "@/lib/popup/menus";
import {
  createRange,
  deleteRange,
  listRanges,
  listRedemptions,
  parseSerial,
  setRangeActive,
} from "@/lib/popup/tickets";

// Protected by the middleware matcher on /api/admin/:path*.

/** GET — a pop-up's ticket ranges and the most recent tickets played. */
export async function GET(req: NextRequest) {
  const menuId = req.nextUrl.searchParams.get("menuId") ?? "";
  const menu = await getMenuById(menuId);
  if (!menu) return NextResponse.json({ error: "Pop-up not found." }, { status: 404 });

  try {
    const [ranges, redemptions] = await Promise.all([listRanges(menu.id), listRedemptions(menu.id)]);
    return NextResponse.json({ ranges, redemptions });
  } catch (e) {
    console.error("[GET /api/admin/popup/tickets]", e);
    return NextResponse.json(
      { error: "Could not load tickets. Has db/popup-tickets.sql been run in Supabase?" },
      { status: 500 }
    );
  }
}

/** POST — add a serial range for one cocktail's game. */
export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const menu = await getMenuById(String(body.menuId ?? ""));
  if (!menu) return NextResponse.json({ error: "Pop-up not found." }, { status: 404 });

  const cocktails = await getCocktails(menu.id, { includeInactive: true });
  const cocktail = cocktails.find((c) => c.id === String(body.cocktailId ?? ""));
  if (!cocktail) {
    return NextResponse.json(
      { error: "Save the pop-up first, then add tickets to that cocktail." },
      { status: 400 }
    );
  }

  const start = parseSerial(body.startSerial);
  const end = parseSerial(body.endSerial);
  if (start === null || end === null) {
    return NextResponse.json(
      { error: "Enter the first and last ticket numbers, digits only." },
      { status: 400 }
    );
  }

  const result = await createRange({
    menuId: menu.id,
    cocktailId: cocktail.id,
    startSerial: start,
    endSerial: end,
  });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ ok: true, range: result.range });
}

/** PATCH — pause or resume a range. */
export async function PATCH(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const ok = await setRangeActive(String(body.id ?? ""), body.active === true);
  if (!ok) return NextResponse.json({ error: "Could not update that range." }, { status: 500 });
  return NextResponse.json({ ok: true });
}

/**
 * DELETE — remove a range. Tickets already played from it keep their scores;
 * unplayed tickets in it stop working.
 */
export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id") ?? "";
  if (!id) return NextResponse.json({ error: "Missing id." }, { status: 400 });
  const ok = await deleteRange(id);
  if (!ok) return NextResponse.json({ error: "Could not delete that range." }, { status: 500 });
  return NextResponse.json({ ok: true });
}
