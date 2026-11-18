import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, getSession } from "@/lib/session";
import {
  listAdminUsers, createAdminUser, updateAdminUser, deleteAdminUser,
  isMissingTable, UserInputError,
} from "@/lib/adminUsers";

// Admin panel users. MAIN ADMIN ONLY — the middleware lets any signed-in user
// reach /api/admin/*, so every handler here checks the role itself (and the
// middleware blocks this path for users as well, as a second lock).

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function ownerOnly(req: NextRequest): Promise<NextResponse | null> {
  const session = await getSession(req.cookies.get(SESSION_COOKIE)?.value);
  if (session?.role === "owner") return null;
  return NextResponse.json({ error: "Only the main admin can manage users." }, { status: 403 });
}

function fail(where: string, e: unknown): NextResponse {
  if (e instanceof UserInputError) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
  if (isMissingTable(e)) {
    return NextResponse.json(
      { error: "The users table doesn't exist yet. Run db/admin-users.sql in Supabase.", setup: true },
      { status: 500 }
    );
  }
  console.error(`[${where} /api/admin/users]`, e);
  return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
}

export async function GET(req: NextRequest) {
  const denied = await ownerOnly(req);
  if (denied) return denied;
  try {
    return NextResponse.json({ users: await listAdminUsers() });
  } catch (e) {
    return fail("GET", e);
  }
}

export async function POST(req: NextRequest) {
  const denied = await ownerOnly(req);
  if (denied) return denied;
  try {
    const body = await req.json();
    const user = await createAdminUser({ username: body.username, name: body.name, password: body.password });
    return NextResponse.json({ user });
  } catch (e) {
    return fail("POST", e);
  }
}

export async function PATCH(req: NextRequest) {
  const denied = await ownerOnly(req);
  if (denied) return denied;
  try {
    const body = await req.json();
    if (typeof body.id !== "string" || !UUID.test(body.id)) {
      return NextResponse.json({ error: "Missing user." }, { status: 400 });
    }
    const user = await updateAdminUser(body.id, {
      username: body.username, name: body.name, password: body.password,
    });
    return NextResponse.json({ user });
  } catch (e) {
    return fail("PATCH", e);
  }
}

export async function DELETE(req: NextRequest) {
  const denied = await ownerOnly(req);
  if (denied) return denied;
  try {
    const body = await req.json();
    if (typeof body.id !== "string" || !UUID.test(body.id)) {
      return NextResponse.json({ error: "Missing user." }, { status: 400 });
    }
    await deleteAdminUser(body.id);
    return NextResponse.json({ success: true });
  } catch (e) {
    return fail("DELETE", e);
  }
}
