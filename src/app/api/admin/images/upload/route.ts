import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

const BUCKET = "images";
const ALLOWED_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif", "image/svg+xml"];
const MAX_SIZE_MB = 10;

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: "Unsupported image type. Use JPG, PNG, WebP, GIF, or SVG." },
        { status: 400 }
      );
    }

    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      return NextResponse.json(
        { error: `File too large. Maximum size is ${MAX_SIZE_MB}MB.` },
        { status: 400 }
      );
    }

    // Sanitize filename and add timestamp to avoid collisions
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
    const baseName = file.name
      .replace(/\.[^.]+$/, "")                 // strip extension
      .replace(/[^a-zA-Z0-9._-]/g, "_")        // sanitize
      .slice(0, 60);                            // limit length
    const safeName = `${baseName}-${Date.now()}.${ext}`;

    const bytes = await file.arrayBuffer();
    const sb = getSupabaseAdmin();

    const { error } = await sb.storage.from(BUCKET).upload(safeName, bytes, {
      contentType: file.type,
      upsert: false, // never silently overwrite
    });
    if (error) throw error;

    const { data: urlData } = sb.storage.from(BUCKET).getPublicUrl(safeName);

    return NextResponse.json({
      success: true,
      name: safeName,
      url: urlData.publicUrl,
      size: file.size,
      mimeType: file.type,
    });
  } catch (err) {
    console.error("Image upload error:", err);
    return NextResponse.json({ error: "Upload failed: " + String(err) }, { status: 500 });
  }
}
