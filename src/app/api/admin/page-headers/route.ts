import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import type { PageHeaderData } from "@/types";

// GET — return all page header configs keyed by page_id
export async function GET() {
  try {
    const sb = getSupabaseAdmin();
    const { data, error } = await sb.from("page_headers").select("page_id, data");
    if (error) throw error;
    const result: Record<string, PageHeaderData> = {};
    for (const row of data ?? []) {
      result[row.page_id] = row.data as PageHeaderData;
    }
    return NextResponse.json({ pages: result });
  } catch (e) {
    console.error("[GET /api/admin/page-headers]", e);
    return NextResponse.json({ pages: {} });
  }
}

// POST — upsert one page's header config
export async function POST(req: NextRequest) {
  try {
    const { pageId, data }: { pageId: string; data: PageHeaderData } = await req.json();
    const sb = getSupabaseAdmin();
    const { error } = await sb.from("page_headers").upsert(
      { page_id: pageId, data, updated_at: new Date().toISOString() },
      { onConflict: "page_id" }
    );
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("[POST /api/admin/page-headers]", e);
    return NextResponse.json({ success: false, error: String(e) }, { status: 500 });
  }
}
