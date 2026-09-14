import { NextRequest, NextResponse } from "next/server";
import { getViewer } from "@/lib/popup/auth";
import { getCocktails, getMenuById, resolveLiveMenu } from "@/lib/popup/menus";
import { isPlayableGame } from "@/lib/popup/games";
import { checkRateLimit } from "@/lib/popup/access";
import { parseSerial, redeemTicket } from "@/lib/popup/tickets";

/**
 * POST — spend a raffle ticket on one High Score Run.
 *
 * Signed-in guests only, on the live pop-up only. Returns a `runId` the game
 * sends back with its score; without one, a score is never recorded.
 *
 * Ticket serials are sequential, so a wrong guess is rate limited much harder
 * than a right one — trying numbers near your own ticket should run dry fast.
 */
export async function POST(req: NextRequest) {
  const viewer = await getViewer();
  if (!viewer) {
    return NextResponse.json(
      { error: "Sign in to start a High Score Run.", reason: "not_signed_in" },
      { status: 401 }
    );
  }

  const attempts = checkRateLimit(`ticket:${viewer.userId}`, 30, 30 * 60 * 1000);
  if (attempts.blocked) {
    return NextResponse.json(
      { error: "Too many tickets tried. Ask your bartender for help." },
      { status: 429, headers: { "Retry-After": String(attempts.retryAfterSec) } }
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const menu = await getMenuById(String(body.menuId ?? ""));
  if (!menu) return NextResponse.json({ error: "That pop-up doesn't exist." }, { status: 404 });

  const live = await resolveLiveMenu();
  if (!live || live.id !== menu.id) {
    return NextResponse.json(
      { error: "This pop-up has closed — high scores are final." },
      { status: 403 }
    );
  }

  const cocktails = await getCocktails(menu.id);
  const cocktail = cocktails.find((c) => c.id === String(body.cocktailId ?? ""));
  if (!cocktail?.gameKey || !isPlayableGame(cocktail.gameKey)) {
    return NextResponse.json({ error: "That game isn't available." }, { status: 400 });
  }

  const serial = parseSerial(body.serial);
  if (serial === null) {
    return NextResponse.json(
      { error: "Enter the number printed on your ticket — digits only." },
      { status: 400 }
    );
  }

  const result = await redeemTicket({
    menuId: menu.id,
    cocktailId: cocktail.id,
    gameKey: cocktail.gameKey,
    userId: viewer.userId,
    serial,
  });

  if (result.ok) {
    return NextResponse.json({ ok: true, runId: result.redemptionId });
  }

  // Only wrong numbers count toward the stricter limit.
  if (result.reason === "not_found" || result.reason === "wrong_game") {
    const misses = checkRateLimit(`ticket-miss:${viewer.userId}`, 8, 30 * 60 * 1000);
    if (misses.blocked) {
      return NextResponse.json(
        { error: "Too many numbers that didn't match. Ask your bartender for help." },
        { status: 429, headers: { "Retry-After": String(misses.retryAfterSec) } }
      );
    }
  }

  const other =
    result.reason === "wrong_game"
      ? cocktails.find((c) => c.id === result.otherCocktailId)?.name
      : undefined;

  const message: Record<typeof result.reason, string> = {
    invalid: "Enter the number printed on your ticket.",
    not_found: "That ticket number isn't valid. Check the number and try again.",
    wrong_game: other
      ? `That ticket is for ${other}. Play it on that game instead.`
      : "That ticket is for a different game.",
    already_used: "That ticket has already been played.",
    error: "Something went wrong. Please try again.",
  };

  return NextResponse.json(
    { error: message[result.reason], reason: result.reason },
    { status: result.reason === "error" ? 500 : 400 }
  );
}
