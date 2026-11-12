import { NextResponse, type NextRequest } from "next/server";
import { reportNotMe } from "@/lib/reserve/bible";
import { guard, fromError, readJson, bad } from "@/lib/reserve/route";
import { phoneDigits } from "@/lib/reserve/format";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const stop = guard(req, "lookup");
  if (stop) return stop;
  const body = await readJson(req);
  const lookup_token = typeof body.lookup_token === "string" ? body.lookup_token.slice(0, 2000) : "";
  const value = typeof body.value === "string" ? body.value.trim().slice(0, 200) : "";
  if (!lookup_token) return bad("Please enter your email or phone again.");
  try {
    await reportNotMe({
      lookup_token,
      ...(value.includes("@") ? { email: value } : { phone: phoneDigits(value) }),
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return fromError(e);
  }
}
