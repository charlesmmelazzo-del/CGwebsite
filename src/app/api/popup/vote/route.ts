import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/session";
import { getViewer } from "@/lib/popup/auth";
import { getCocktails, getMenuById, resolveLiveMenu } from "@/lib/popup/menus";
import { getBallot, getLeaderboard, replaceBallot, validateBallot } from "@/lib/popup/voting";
import { checkRateLimit, voteBlockReason, VOTE_BLOCK_MESSAGE } from "@/lib/popup/access";

/**
 * Cast or replace a ballot.
 *
 * This route is the enforcement point for every voting rule. The UI hiding a
 * vote button is a convenience; a request posted directly here still has to
 * get past all of the following:
 *
 *   1. Signed in — the user id comes from the session cookie, never the body.
 *   2. Email confirmed and age verified.
 *   3. The target pop-up is the one that is actually live right now.
 *   4. The ballot is well-formed for that pop-up's rank depth.
 *
 * And beneath all of it, two unique indexes in Postgres make a duplicate
 * cocktail or a duplicate rank slot impossible to store at all.
 */
export async function POST(req: NextRequest) {
  const viewer = await getViewer();
  if (!viewer) {
    return NextResponse.json(
      { error: VOTE_BLOCK_MESSAGE.not_signed_in, reason: "not_signed_in" },
      { status: 401 }
    );
  }

  const rl = checkRateLimit(`vote:${viewer.userId}`, 30, 10 * 60 * 1000);
  if (rl.blocked) {
    return NextResponse.json(
      { error: "You're changing your vote very quickly. Please wait a moment." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } }
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const menuId = String(body.menuId ?? "");
  const menu = await getMenuById(menuId);
  if (!menu) {
    return NextResponse.json({ error: "That pop-up doesn't exist." }, { status: 404 });
  }

  // Sandbox votes are only honoured for a genuine admin session. Without that
  // check, anyone could set sandbox:true and vote on an unpublished pop-up.
  const wantsSandbox = body.sandbox === true;
  const isAdmin = await verifySessionToken(cookies().get(SESSION_COOKIE)?.value);
  const isSandbox = wantsSandbox && isAdmin;

  if (wantsSandbox && !isAdmin) {
    return NextResponse.json({ error: "Not authorized." }, { status: 403 });
  }

  if (!isSandbox) {
    const live = await resolveLiveMenu();
    const reason = voteBlockReason(viewer, menu, live?.id ?? null);
    if (reason) {
      return NextResponse.json(
        { error: VOTE_BLOCK_MESSAGE[reason], reason },
        { status: 403 }
      );
    }
  }

  const cocktails = await getCocktails(menu.id);
  const check = validateBallot(menu, cocktails, body.ranked);
  if (!check.ok || !check.ranked) {
    return NextResponse.json({ error: check.error }, { status: 400 });
  }

  const saved = await replaceBallot(menu.id, viewer.userId, check.ranked, isSandbox);
  if (!saved.ok) {
    return NextResponse.json({ error: saved.error }, { status: 500 });
  }

  const [ballot, results] = await Promise.all([
    getBallot(menu.id, viewer.userId, isSandbox),
    getLeaderboard(menu, cocktails, isSandbox),
  ]);

  return NextResponse.json({ ok: true, ballot, results });
}

/** DELETE — withdraw this guest's ballot entirely. */
export async function DELETE(req: NextRequest) {
  const viewer = await getViewer();
  if (!viewer) {
    return NextResponse.json({ error: VOTE_BLOCK_MESSAGE.not_signed_in }, { status: 401 });
  }

  const menuId = req.nextUrl.searchParams.get("menuId") ?? "";
  const menu = await getMenuById(menuId);
  if (!menu) return NextResponse.json({ error: "That pop-up doesn't exist." }, { status: 404 });

  const isAdmin = await verifySessionToken(cookies().get(SESSION_COOKIE)?.value);
  const isSandbox = req.nextUrl.searchParams.get("sandbox") === "1" && isAdmin;

  if (!isSandbox) {
    const live = await resolveLiveMenu();
    const reason = voteBlockReason(viewer, menu, live?.id ?? null);
    if (reason) {
      return NextResponse.json({ error: VOTE_BLOCK_MESSAGE[reason], reason }, { status: 403 });
    }
  }

  await replaceBallot(menu.id, viewer.userId, [], isSandbox);
  const cocktails = await getCocktails(menu.id);
  const results = await getLeaderboard(menu, cocktails, isSandbox);

  return NextResponse.json({ ok: true, ballot: [], results });
}
