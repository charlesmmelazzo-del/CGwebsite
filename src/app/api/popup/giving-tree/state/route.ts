import { NextResponse, type NextRequest } from "next/server";
import { resolveMode } from "@/lib/givingTree/access";
import { fail, noStore } from "@/lib/givingTree/http";
import { buildState, loadAll, sweepQuietly } from "@/lib/givingTree/service";

export const dynamic = "force-dynamic";

/**
 * Everything the tree and the sky need. Public outside the sandbox, so it
 * only ever carries public fields (see buildState): no emails, phones, real
 * names of anonymous guests, admin contacts or hidden addresses.
 */
export async function GET(req: NextRequest) {
  try {
    const mode = await resolveMode(req.nextUrl.searchParams.get("sandbox") === "1");
    if (!mode) return NextResponse.json({ error: "Not available." }, { status: 404 });
    await sweepQuietly();
    return NextResponse.json(buildState(await loadAll(), mode), noStore);
  } catch (e) {
    return fail(e);
  }
}
