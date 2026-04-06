import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

// GET — list form submissions (admin-only, protected by middleware)
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const formId = searchParams.get("formId");

    const sb = getSupabaseAdmin();
    let query = sb
      .from("form_submissions")
      .select("*")
      .order("submitted_at", { ascending: false })
      .limit(500);

    if (formId) {
      query = query.eq("form_id", formId);
    }

    const { data, error } = await query;
    if (error) throw error;

    // Map snake_case columns to camelCase for the frontend
    const submissions = (data ?? []).map((r) => ({
      id:          r.id,
      formId:      r.form_id,
      formName:    r.form_name,
      data:        r.data,
      submittedAt: r.submitted_at,
    }));

    return NextResponse.json(submissions);
  } catch (e) {
    console.error("[GET /api/admin/forms]", e);
    return NextResponse.json([], { status: 500 });
  }
}

// DELETE — remove a single submission by id
export async function DELETE(req: NextRequest) {
  try {
    const { id } = await req.json();
    if (!id) return NextResponse.json({ success: false, error: "id required" }, { status: 400 });

    const sb = getSupabaseAdmin();
    const { error } = await sb.from("form_submissions").delete().eq("id", id);
    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("[DELETE /api/admin/forms]", e);
    return NextResponse.json({ success: false, error: String(e) }, { status: 500 });
  }
}
