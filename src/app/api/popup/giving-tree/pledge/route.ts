import { NextResponse, type NextRequest } from "next/server";
import { getIp } from "@/lib/rateLimit";
import { looksLikeBot } from "@/lib/reserve/route";
import { isAdmin, resolveMode } from "@/lib/givingTree/access";
import { COPY } from "@/lib/givingTree/copy";
import { fail, readBody } from "@/lib/givingTree/http";
import { createPledge, parsePledgeInput, TreeError } from "@/lib/givingTree/service";

export const dynamic = "force-dynamic";

/** A guest hangs an ornament (3.3). Every field is checked again here. */
export async function POST(req: NextRequest) {
  try {
    const body = await readBody(req);
    // Honeypot filled in, or submitted faster than a person could type.
    if (looksLikeBot(body)) throw new TreeError(COPY.errGeneric, 400);
    const mode = await resolveMode(body.sandbox === true);
    if (!mode || mode === "closed") throw new TreeError(COPY.errClosed, 409);
    const { result } = await createPledge(parsePledgeInput(body), {
      mode,
      source: "web",
      ip: getIp(req),
      // Staff testing in the sandbox share one address; caps per email still apply.
      skipIpLimit: mode === "sandbox" && (await isAdmin()),
    });
    return NextResponse.json(result);
  } catch (e) {
    return fail(e);
  }
}
