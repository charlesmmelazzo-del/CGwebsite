import { NextResponse } from "next/server";
import { listMarketingContacts } from "@/lib/marketing";

// Protected by the middleware matcher on /api/admin/:path*.

/** GET — the merged, de-duplicated email list. */
export async function GET() {
  try {
    return NextResponse.json({ contacts: await listMarketingContacts() });
  } catch (e) {
    console.error("[GET /api/admin/marketing]", e);
    return NextResponse.json({ error: "Could not load the email list." }, { status: 500 });
  }
}
