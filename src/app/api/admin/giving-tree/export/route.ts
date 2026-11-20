import { NextResponse, type NextRequest } from "next/server";
import { exportCsv } from "@/lib/givingTree/admin";
import { fail } from "@/lib/givingTree/http";

export const dynamic = "force-dynamic";

/** CSV downloads (9.10): ?kind=volunteers&org=<id> | pledges | recap, &demo=1 to include demo records. */
export async function GET(req: NextRequest) {
  try {
    const q = req.nextUrl.searchParams;
    const { filename, body } = await exportCsv(q.get("kind") ?? "", { orgId: q.get("org") ?? undefined, includeDemo: q.get("demo") === "1" });
    return new NextResponse(body, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    return fail(e);
  }
}
