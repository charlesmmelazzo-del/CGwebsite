import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

// GET /api/admin/page-content?slug=about
export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get("slug");
  if (!slug) return NextResponse.json({ sections: [] });
  try {
    const sb = getSupabaseAdmin();
    const { data } = await sb
      .from("pages")
      .select("sections")
      .eq("slug", slug)
      .maybeSingle();
    return NextResponse.json({ sections: data?.sections ?? [] });
  } catch (e) {
    console.error("[GET /api/admin/page-content]", e);
    return NextResponse.json({ sections: [] });
  }
}

// POST /api/admin/page-content  {slug, label, sections}
export async function POST(req: NextRequest) {
  try {
    const { slug, label, sections } = await req.json();
    if (!slug || !Array.isArray(sections)) {
      return NextResponse.json({ success: false, error: "slug and sections required" }, { status: 400 });
    }
    const sb = getSupabaseAdmin();
    const { error } = await sb.from("pages").upsert(
      { page_id: slug, slug, label: label ?? slug, sections, updated_at: new Date().toISOString() },
      { onConflict: "page_id" }
    );
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("[POST /api/admin/page-content]", e);
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
