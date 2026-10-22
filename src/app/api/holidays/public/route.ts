import { NextResponse } from "next/server";
import { failure } from "@/lib/holidays/http";
import { publicSummary } from "@/lib/holidays/public/store";

export const dynamic = "force-dynamic";

/** GET — the bar-wide games: who's playing now, today's leaders, past daily winners. */
export async function GET() {
  try {
    return NextResponse.json({ games: await publicSummary() });
  } catch (e) {
    return failure(e);
  }
}
