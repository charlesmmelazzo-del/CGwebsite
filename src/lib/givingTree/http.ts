// ─── The Giving Tree — route helpers (server only) ───────────────────────────

import "server-only";
import { NextResponse } from "next/server";
import { COPY } from "./copy";
import { TreeError } from "./service";
import { TreeNotSetUp } from "./store";

export function fail(e: unknown) {
  if (e instanceof TreeError) return NextResponse.json({ error: e.message }, { status: e.status });
  if (e instanceof TreeNotSetUp) {
    console.error("[giving-tree]", e.message);
    return NextResponse.json({ error: "The Giving Tree isn't set up yet (run db/giving-tree.sql)." }, { status: 503 });
  }
  console.error("[giving-tree]", e);
  return NextResponse.json({ error: COPY.errGeneric }, { status: 500 });
}

export async function readBody(req: Request): Promise<Record<string, unknown>> {
  try {
    const raw = await req.text();
    if (raw.length > 2_000_000) return {};
    const v = JSON.parse(raw || "{}");
    return v && typeof v === "object" && !Array.isArray(v) ? v : {};
  } catch {
    return {};
  }
}

export const noStore = { headers: { "Cache-Control": "no-store" } };
