import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, getSession } from "@/lib/session";

// Who is signed in — lets the admin show the Users tab to the main admin only,
// and the name of whoever's using it. The middleware has already checked the
// session before this runs.

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await getSession(req.cookies.get(SESSION_COOKIE)?.value);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({ role: session.role, username: session.username, name: session.name });
}
