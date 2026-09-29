import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

// Receives one PDF page that the admin already rendered to WebP in the browser
// (see src/lib/pdfPages.ts). Pages live in their own folder so they don't
// clutter the image library's picker.
const BUCKET = "images";
const MAX_SIZE_MB = 10;

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }
    if (file.type !== "image/webp" && file.type !== "image/png" && file.type !== "image/jpeg") {
      return NextResponse.json({ error: "Page must be an image." }, { status: 400 });
    }
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      return NextResponse.json(
        { error: `Page image too large. Maximum size is ${MAX_SIZE_MB}MB.` },
        { status: 400 }
      );
    }

    const ext = file.type === "image/webp" ? "webp" : file.type === "image/png" ? "png" : "jpg";
    const baseName = file.name
      .replace(/\.[^.]+$/, "")
      .replace(/[^a-zA-Z0-9._-]/g, "_")
      .slice(0, 60);
    const safeName = `menu-pdf-pages/${baseName}-${Date.now()}.${ext}`;

    const bytes = await file.arrayBuffer();
    const sb = getSupabaseAdmin();

    const { error } = await sb.storage.from(BUCKET).upload(safeName, bytes, {
      contentType: file.type,
      cacheControl: "31536000", // names are unique per upload, so cache forever
      upsert: false,
    });
    if (error) throw error;

    const { data: urlData } = sb.storage.from(BUCKET).getPublicUrl(safeName);
    return NextResponse.json({ success: true, url: urlData.publicUrl });
  } catch (err) {
    console.error("Menu PDF page upload error:", err);
    return NextResponse.json({ error: "Upload failed: " + String(err) }, { status: 500 });
  }
}
