import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/session";
import { getSupabaseAdmin } from "@/lib/supabase";
import { getViewer } from "@/lib/popup/auth";
import { getMenuById } from "@/lib/popup/menus";
import { checkRateLimit, getIp } from "@/lib/popup/access";

/**
 * Record an interactive event from a pop-up template.
 *
 * This is the extensibility hook. A trivia round posts `kind: "trivia_answer"`,
 * a mini game posts `kind: "game_score"` — each with whatever payload it needs.
 * New interactive formats never require a schema change or a new endpoint.
 *
 * Unlike voting, this does NOT require a confirmed email: a guest who just
 * signed up can play with the pop-up straight away. Only their ballot waits on
 * confirmation.
 */
export async function POST(req: NextRequest) {
  const viewer = await getViewer();

  // Keyed on the user when we have one so a shared IP (a bar full of guests on
  // one wifi) doesn't lock everyone out mid-game.
  const rl = checkRateLimit(`interaction:${viewer?.userId ?? getIp(req)}`, 240, 60 * 1000);
  if (rl.blocked) {
    return NextResponse.json({ error: "Slow down a moment." }, { status: 429 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const kind = String(body.kind ?? "").trim();
  if (!kind || kind.length > 64) {
    return NextResponse.json({ error: "Invalid interaction kind." }, { status: 400 });
  }

  const menu = await getMenuById(String(body.menuId ?? ""));
  if (!menu) {
    return NextResponse.json({ error: "That pop-up doesn't exist." }, { status: 404 });
  }

  const isAdmin = await verifySessionToken(cookies().get(SESSION_COOKIE)?.value);
  const isSandbox = body.sandbox === true && isAdmin;

  // Keep a stray huge payload from a buggy template out of the database.
  const payload = body.payload ?? {};
  if (JSON.stringify(payload).length > 8000) {
    return NextResponse.json({ error: "Interaction payload too large." }, { status: 413 });
  }

  try {
    const sb = getSupabaseAdmin();
    await sb.from("popup_interactions").insert({
      menu_id: menu.id,
      cocktail_id: body.cocktailId ? String(body.cocktailId) : null,
      user_id: viewer?.userId ?? null,
      kind,
      payload,
      is_test: isSandbox,
    });
  } catch (e) {
    console.error("[popup] interaction insert failed", e);
    return NextResponse.json({ error: "Could not record that." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
