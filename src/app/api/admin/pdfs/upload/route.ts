import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

const BUCKET = "images"; // reuse existing public bucket
const MAX_SIZE_MB = 20;

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (file.type !== "application/pdf") {
      return NextResponse.json({ error: "Only PDF files are accepted." }, { status: 400 });
    }

    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      return NextResponse.json(
        { error: `File too large. Maximum size is ${MAX_SIZE_MB}MB.` },
        { status: 400 }
      );
    }

    const baseName = file.name
      .replace(/\.pdf$/i, "")
      .replace(/[^a-zA-Z0-9._-]/g, "_")
      .slice(0, 60);
    const safeName = `pdfs/${baseName}-${Date.now()}.pdf`;

    const bytes = await file.arrayBuffer();
    const sb = getSupabaseAdmin();

    const { error } = await sb.storage.from(BUCKET).upload(safeName, bytes, {
      contentType: "application/pdf",
      upsert: false,
    });
    if (error) throw error;

    const { data: urlData } = sb.storage.from(BUCKET).getPublicUrl(safeName);

    return NextResponse.json({
      success: true,
      name: safeName,
      url: urlData.publicUrl,
      size: file.size,
    });
  } catch (err) {
    console.error("PDF upload error:", err);
    return NextResponse.json({ error: "Upload failed: " + String(err) }, { status: 500 });
  }
}
