import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/session";
import { getCocktails, getMenuById, resolveLiveMenu } from "@/lib/popup/menus";
import { getLeaderboard, getVoterCount } from "@/lib/popup/voting";

/**
 * Public standings for a pop-up.
 *
 * Results are visible to everyone, including on closed pop-ups — seeing what
 * won is the point of the archive. Sandbox tallies stay behind the admin
 * cookie so test votes never leak into a public leaderboard.
 */
export async function GET(req: NextRequest) {
  const menuId = req.nextUrl.searchParams.get("menuId") ?? "";
  const menu = await getMenuById(menuId);
  if (!menu) {
    return NextResponse.json({ error: "That pop-up doesn't exist." }, { status: 404 });
  }

  const isAdmin = await verifySessionToken(cookies().get(SESSION_COOKIE)?.value);
  const isSandbox = req.nextUrl.searchParams.get("sandbox") === "1" && isAdmin;

  const [cocktails, live] = await Promise.all([getCocktails(menu.id), resolveLiveMenu()]);
  const [results, voterCount] = await Promise.all([
    getLeaderboard(menu, cocktails, isSandbox),
    getVoterCount(menu.id, isSandbox),
  ]);

  return NextResponse.json({
    results,
    voterCount,
    votingOpen: Boolean(live && live.id === menu.id && menu.votingEnabled),
  });
}
