import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/session";
import { getViewer } from "@/lib/popup/auth";
import { getCocktails, getMenuById, resolveLiveMenu } from "@/lib/popup/menus";
import { getGameBoard, MAX_SCORE, recordScore } from "@/lib/popup/scores";
import { isPlayableGame } from "@/lib/popup/games";
import { checkRateLimit } from "@/lib/popup/access";

/**
 * GET — the public leaderboard for one game on one pop-up.
 * Readable by anyone, including after the pop-up closes: seeing who won is
 * half the point of the archive.
 */
export async function GET(req: NextRequest) {
  const menuId = req.nextUrl.searchParams.get("menuId") ?? "";
  const gameKey = req.nextUrl.searchParams.get("gameKey") ?? "";

  if (!isPlayableGame(gameKey)) {
    return NextResponse.json({ error: "Unknown game." }, { status: 404 });
  }

  const menu = await getMenuById(menuId);
  if (!menu) return NextResponse.json({ error: "That pop-up doesn't exist." }, { status: 404 });

  const isAdmin = await verifySessionToken(cookies().get(SESSION_COOKIE)?.value);
  const isTest = req.nextUrl.searchParams.get("sandbox") === "1" && isAdmin;

  const viewer = await getViewer();
  const board = await getGameBoard(menu.id, gameKey, viewer?.userId ?? null, isTest);

  return NextResponse.json({ board });
}

/**
 * POST — record a play-through.
 *
 * A score is only stored for a signed-in guest: the prize has to reach a real
 * person, and an anonymous board would be trivial to stuff. Confirming their
 * email isn't required to *play* or to appear on the board — it's required to
 * be paid, which the UI says plainly and the admin winners panel flags.
 *
 * This endpoint trusts the client's number, which is unavoidable for a
 * client-side arcade game. What it does instead is make cheating visible:
 * every run is stored with its detail, scores are capped, and the owner sends
 * the gift cards by hand after looking at the winner.
 */
export async function POST(req: NextRequest) {
  const viewer = await getViewer();
  if (!viewer) {
    return NextResponse.json(
      { error: "Sign in to save your score.", reason: "not_signed_in" },
      { status: 401 }
    );
  }

  const rl = checkRateLimit(`score:${viewer.userId}`, 60, 10 * 60 * 1000);
  if (rl.blocked) {
    return NextResponse.json(
      { error: "That's a lot of games very quickly. Take a breath." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } }
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const gameKey = String(body.gameKey ?? "");
  if (!isPlayableGame(gameKey)) {
    return NextResponse.json({ error: "Unknown game." }, { status: 400 });
  }

  const menu = await getMenuById(String(body.menuId ?? ""));
  if (!menu) return NextResponse.json({ error: "That pop-up doesn't exist." }, { status: 404 });

  const wantsSandbox = body.sandbox === true;
  const isAdmin = await verifySessionToken(cookies().get(SESSION_COOKIE)?.value);
  if (wantsSandbox && !isAdmin) {
    return NextResponse.json({ error: "Not authorized." }, { status: 403 });
  }
  const isTest = wantsSandbox && isAdmin;

  // Scores only count while the pop-up is the live one. Once it archives the
  // board is frozen, which is what makes "the top scorer at the end" mean
  // something. The sandbox is exempt so games can be tested before launch.
  if (!isTest) {
    const live = await resolveLiveMenu();
    if (!live || live.id !== menu.id) {
      return NextResponse.json(
        { error: "This pop-up has closed — scores are final.", reason: "scoring_closed" },
        { status: 403 }
      );
    }
  }

  const rawScore = Number(body.score);
  if (!Number.isFinite(rawScore) || rawScore < 0) {
    return NextResponse.json({ error: "Invalid score." }, { status: 400 });
  }
  const score = Math.min(MAX_SCORE, Math.floor(rawScore));

  // Only accept a cocktail id that actually belongs to this pop-up.
  const cocktails = await getCocktails(menu.id, { includeInactive: true });
  const cocktailId = String(body.cocktailId ?? "");
  const cocktail = cocktails.find((c) => c.id === cocktailId) ?? null;

  const detail = body.detail && typeof body.detail === "object" ? body.detail : {};
  const safeDetail = JSON.stringify(detail).length <= 4000
    ? (detail as Record<string, unknown>)
    : {};

  const saved = await recordScore({
    menuId: menu.id,
    cocktailId: cocktail?.id ?? null,
    userId: viewer.userId,
    gameKey,
    score,
    detail: safeDetail,
    isTest,
  });
  if (!saved.ok) return NextResponse.json({ error: saved.error }, { status: 500 });

  const board = await getGameBoard(menu.id, gameKey, viewer.userId, isTest);

  return NextResponse.json({
    ok: true,
    board,
    // The UI uses this to tell a guest their run counts but they still need to
    // confirm their email before they can actually be sent a gift card.
    prizeEligible: viewer.emailVerified,
  });
}
