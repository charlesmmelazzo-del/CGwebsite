import { NextRequest, NextResponse } from "next/server";
import { contactsToCsv, listMarketingContacts } from "@/lib/marketing";

// Protected by the middleware matcher on /api/admin/:path*.

/**
 * GET — the email list as a CSV for Mailchimp. `?optedIn=1` leaves out
 * addresses that only came from a Pop Up Zone account.
 */
export async function GET(req: NextRequest) {
  try {
    let contacts = await listMarketingContacts();
    if (req.nextUrl.searchParams.get("optedIn") === "1") contacts = contacts.filter((c) => c.optedIn);
    const date = new Date().toISOString().slice(0, 10);
    return new NextResponse(contactsToCsv(contacts), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="common-good-emails-${date}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    console.error("[GET /api/admin/marketing/export]", e);
    return NextResponse.json({ error: "Could not build the export." }, { status: 500 });
  }
}
