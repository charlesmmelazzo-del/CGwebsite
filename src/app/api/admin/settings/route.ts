import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { SITE_SETTINGS } from "@/lib/constants";
import type { SiteSettings } from "@/types";

async function readData(): Promise<SiteSettings> {
  const sb = getSupabaseAdmin();
  const { data } = await sb.from("site_settings").select("*").eq("id", 1).single();
  if (!data?.data) return { ...SITE_SETTINGS };
  return data.data as SiteSettings;
}

// GET — return current site settings
export async function GET() {
  try {
    return NextResponse.json(await readData());
  } catch (e) {
    console.error("[GET /api/admin/settings]", e);
    return NextResponse.json({ ...SITE_SETTINGS });
  }
}

// POST — save site settings
export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as SiteSettings;
    const sb = getSupabaseAdmin();
    const { error } = await sb.from("site_settings").upsert(
      { id: 1, data: body, updated_at: new Date().toISOString() },
      { onConflict: "id" }
    );
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("[POST /api/admin/settings]", e);
    return NextResponse.json({ success: false, error: String(e) }, { status: 500 });
  }
}
