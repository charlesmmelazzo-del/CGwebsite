import { NextRequest, NextResponse } from "next/server";
import { getViewer } from "@/lib/popup/auth";
import { getMenuById } from "@/lib/popup/menus";
import { checkRateLimit } from "@/lib/popup/access";
import {
  loadTikiProgress,
  saveTikiProgress,
  type TikiProgress,
} from "@/lib/popup/tiki";

/**
 * The Tiki Wars save file.
 *
 * Sign-in only, in both directions. Progression is the reason to have an
 * account — "sign in to keep your armor" — and an anonymous save file would be
 * both unattributable and trivial to forge.
 *
 * Like the score endpoint, this trusts the client's numbers, which is
 * unavoidable for a client-side arcade game. What it does instead is make
 * cheating visible and bounded: every field is clamped to a sane range here and
 * again by a check constraint in the database, and the owner looks at a winner
 * before sending them anything.
 */

export async function GET(req: NextRequest) {
  const viewer = await getViewer();
  if (!viewer) {
    return NextResponse.json(
      { error: "Sign in to keep your progress.", reason: "not_signed_in" },
      { status: 401 }
    );
  }

  const menuId = req.nextUrl.searchParams.get("menuId") ?? "";
  const menu = await getMenuById(menuId);
  if (!menu) return NextResponse.json({ error: "That pop-up doesn't exist." }, { status: 404 });

  const progress = await loadTikiProgress(viewer.userId, menu.id);
  return NextResponse.json({ progress });
}

export async function POST(req: NextRequest) {
  const viewer = await getViewer();
  if (!viewer) {
    return NextResponse.json(
      { error: "Sign in to keep your progress.", reason: "not_signed_in" },
      { status: 401 }
    );
  }

  const rl = checkRateLimit(`tiki:${viewer.userId}`, 120, 10 * 60 * 1000);
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

  const menu = await getMenuById(String(body.menuId ?? ""));
  if (!menu) return NextResponse.json({ error: "That pop-up doesn't exist." }, { status: 404 });

  const progress: TikiProgress = {
    money: num(body.money),
    armor: num(body.armor),
    luck: num(body.luck),
    bestStage: num(body.bestStage),
    totalScore: num(body.totalScore),
    runs: num(body.runs),
  };

  const saved = await saveTikiProgress(viewer.userId, menu.id, progress);
  if (!saved.ok) return NextResponse.json({ error: saved.error }, { status: 500 });

  return NextResponse.json({ progress: saved.progress });
}

function num(v: unknown): number {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}
