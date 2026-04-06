import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

const DEFAULT_DATA = {
  fonts: [],
  assignments: { display: null, body: null, nav: null, button: null, label: null },
};

async function readData() {
  const sb = getSupabaseAdmin();
  const { data } = await sb.from("fonts_data").select("*").eq("id", 1).single();
  if (!data) return { ...DEFAULT_DATA };
  return { fonts: data.fonts ?? [], assignments: data.assignments ?? DEFAULT_DATA.assignments };
}

async function writeData(payload: { fonts: unknown[]; assignments: Record<string, unknown> }) {
  const sb = getSupabaseAdmin();
  const { error } = await sb.from("fonts_data").upsert(
    { id: 1, fonts: payload.fonts, assignments: payload.assignments, updated_at: new Date().toISOString() },
    { onConflict: "id" }
  );
  if (error) throw error;
}

// GET — return all font data (fonts list + assignments)
export async function GET() {
  try {
    return NextResponse.json(await readData());
  } catch (e) {
    console.error("[GET /api/admin/fonts]", e);
    return NextResponse.json(DEFAULT_DATA);
  }
}

// POST — update assignments or add a font entry
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const data = await readData();

    if (body.action === "updateAssignments") {
      data.assignments = { ...data.assignments, ...body.assignments };
    } else if (body.action === "addFont") {
      data.fonts = [...data.fonts, body.font];
    }

    await writeData(data);
    return NextResponse.json({ success: true, data });
  } catch (e) {
    console.error("[POST /api/admin/fonts]", e);
    return NextResponse.json({ success: false, error: String(e) }, { status: 500 });
  }
}

// DELETE — remove a font entry by id
export async function DELETE(req: NextRequest) {
  try {
    const body = await req.json();
    const data = await readData();
    data.fonts = (data.fonts as { id: string }[]).filter((f) => f.id !== body.id);
    await writeData(data);
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("[DELETE /api/admin/fonts]", e);
    return NextResponse.json({ success: false, error: String(e) }, { status: 500 });
  }
}
