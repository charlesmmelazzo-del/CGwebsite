import { NextRequest, NextResponse } from "next/server";
import { getMenuById } from "@/lib/popup/menus";
import { checkRateLimit, getIp } from "@/lib/popup/access";
import { addSubscriber, normalizeEmail } from "@/lib/marketing";

/**
 * POST — a guest asks to hear about future pop-ups. No account needed.
 *
 * Signing up twice is fine (the list keeps one row per address), so the reply
 * never reveals whether an address was already on it.
 */
export async function POST(req: NextRequest) {
  const limit = checkRateLimit(`subscribe:${getIp(req)}`, 10, 60 * 60 * 1000);
  if (limit.blocked) {
    return NextResponse.json(
      { error: "Too many sign-ups from here. Try again later." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSec) } }
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  // A hidden field people never see. Bots fill it in; pretend it worked.
  if (body.website) return NextResponse.json({ ok: true });

  const email = normalizeEmail(body.email);
  if (!email) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }

  const menu = body.menuId ? await getMenuById(String(body.menuId)) : null;
  const source = menu ? `Pop-up: ${menu.title}` : "Pop Up Zone";

  if (!(await addSubscriber(email, source))) {
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
