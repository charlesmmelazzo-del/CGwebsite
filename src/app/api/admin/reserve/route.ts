import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getSupabaseAdmin } from "@/lib/supabase";
import { getReserveContent, normalizeReserveContent } from "@/lib/reserve/content";

// Protected by the middleware's /api/admin session check.

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(await getReserveContent());
}

export async function POST(req: NextRequest) {
  try {
    const data = normalizeReserveContent(await req.json());
    const sb = getSupabaseAdmin();
    const { error } = await sb
      .from("reserve_page")
      .upsert({ id: 1, data, updated_at: new Date().toISOString() }, { onConflict: "id" });
    if (error) {
      const missing = /reserve_page/.test(error.message) && /(does not exist|schema cache)/i.test(error.message);
      return NextResponse.json(
        { success: false, error: missing ? "The reserve_page table doesn't exist yet. Run db/reserve-page.sql in Supabase." : error.message },
        { status: 500 },
      );
    }
    revalidatePath("/reserve");
    return NextResponse.json({ success: true, content: data });
  } catch (e) {
    console.error("[POST /api/admin/reserve]", e);
    return NextResponse.json({ success: false, error: String(e) }, { status: 500 });
  }
}
