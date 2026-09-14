import { NextRequest, NextResponse } from "next/server";
import { deleteGuest, listGuests, updateGuest } from "@/lib/popup/guests";

// Protected by the middleware matcher on /api/admin/:path*.

/** GET — every Pop Up Zone guest account. */
export async function GET() {
  try {
    return NextResponse.json({ guests: await listGuests() });
  } catch (e) {
    console.error("[GET /api/admin/popup/guests]", e);
    return NextResponse.json({ error: "Could not load guest accounts." }, { status: 500 });
  }
}

/** PATCH — edit a guest's name, email or password, or confirm their email. */
export async function PATCH(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const id = String(body.id ?? "");
  if (!id) return NextResponse.json({ error: "Missing id." }, { status: 400 });

  const patch: Parameters<typeof updateGuest>[1] = {};
  if (typeof body.email === "string") {
    const email = body.email.trim().toLowerCase();
    if (!email.includes("@")) {
      return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
    }
    patch.email = email;
  }
  if (typeof body.firstName === "string") patch.firstName = body.firstName.trim();
  if (typeof body.lastName === "string") patch.lastName = body.lastName.trim();
  if (typeof body.password === "string" && body.password) {
    if (body.password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters." },
        { status: 400 }
      );
    }
    patch.password = body.password;
  }
  if (body.confirmEmail === true) patch.confirmEmail = true;

  const result = await updateGuest(id, patch);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ ok: true });
}

/** DELETE — remove a guest account and everything they did. */
export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id") ?? "";
  if (!id) return NextResponse.json({ error: "Missing id." }, { status: 400 });
  const ok = await deleteGuest(id);
  if (!ok) return NextResponse.json({ error: "Could not delete that guest." }, { status: 500 });
  return NextResponse.json({ ok: true });
}
