import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import type { PageDocument } from "@/types";

// GET — return all pages
export async function GET() {
  try {
    const sb = getSupabaseAdmin();
    const { data, error } = await sb
      .from("pages")
      .select("*")
      .order("updated_at", { ascending: true });

    if (error) throw error;

    const pages: PageDocument[] = (data ?? []).map((row) => ({
      pageId:    row.page_id,
      label:     row.label,
      slug:      row.slug,
      theme:     row.theme,
      sections:  row.sections ?? [],
      updatedAt: row.updated_at,
    }));

    return NextResponse.json({ pages });
  } catch (e) {
    console.error("[GET /api/admin/pages]", e);
    return NextResponse.json({ pages: [] });
  }
}

// POST — upsert a page (create or update by pageId)
export async function POST(req: NextRequest) {
  try {
    const sb = getSupabaseAdmin();
    const body: PageDocument = await req.json();

    const { error } = await sb.from("pages").upsert(
      {
        page_id:    body.pageId,
        label:      body.label,
        slug:       body.slug,
        theme:      body.theme ?? null,
        sections:   body.sections ?? [],
        updated_at: new Date().toISOString(),
      },
      { onConflict: "page_id" }
    );

    if (error) throw error;
    return NextResponse.json({ success: true, page: body });
  } catch (e) {
    console.error("[POST /api/admin/pages]", e);
    return NextResponse.json({ success: false, error: String(e) }, { status: 500 });
  }
}

// DELETE — remove a page by pageId
export async function DELETE(req: NextRequest) {
  try {
    const sb = getSupabaseAdmin();
    const { pageId } = await req.json();
    const { error } = await sb.from("pages").delete().eq("page_id", pageId);
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("[DELETE /api/admin/pages]", e);
    return NextResponse.json({ success: false, error: String(e) }, { status: 500 });
  }
}
