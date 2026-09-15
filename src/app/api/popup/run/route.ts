import { NextRequest, NextResponse } from "next/server";
import { getViewer } from "@/lib/popup/auth";
import { getCocktails, getMenuById, resolveLiveMenu } from "@/lib/popup/menus";
import { isPlayableGame } from "@/lib/popup/games";
import { checkRateLimit } from "@/lib/popup/access";
import { startRun } from "@/lib/popup/tickets";

/**
 * POST — start one High Score Run on a game the guest has unlocked with a
 * ticket. The run is spent now, as it starts. Returns the `runId` the game
 * sends back with its score.
 */
export async function POST(req: NextRequest) {
  const viewer = await getViewer();
  if (!viewer) {
    return NextResponse.json(
      { error: "Sign in to play a High Score Run.", reason: "not_signed_in" },
      { status: 401 }
    );
  }

  const rl = checkRateLimit(`run:${viewer.userId}`, 30, 10 * 60 * 1000);
  if (rl.blocked) {
    return NextResponse.json(
      { error: "That's a lot of runs very quickly. Take a breath." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } }
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
    return NextResponse.json({ error: "This pop-up has closed — high scores are final." }, { status: 403 });
  }

  const cocktails = await getCocktails(menu.id);
  const cocktail = cocktails.find((c) => c.id === String(body.cocktailId ?? ""));
  if (!cocktail?.gameKey || !isPlayableGame(cocktail.gameKey)) {
    return NextResponse.json({ error: "That game isn't available." }, { status: 400 });
  }

  const result = await startRun({
    menuId: menu.id,
    cocktailId: cocktail.id,
    gameKey: cocktail.gameKey,
    userId: viewer.userId,
  });
  if (result.ok) return NextResponse.json({ ok: true, runId: result.runId, runsLeft: result.runsLeft });

  const message = {
    locked: "Enter the ticket from your cocktail to unlock High Score Runs.",
    no_runs: "You've used all your High Score Runs on this game. Another ticket gets you three more.",
    error: "Something went wrong. Please try again.",
  }[result.reason];
  return NextResponse.json(
    { error: message, reason: result.reason },
    { status: result.reason === "error" ? 500 : 403 }
  );
}
