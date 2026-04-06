import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Validate extension
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
    if (!["woff2", "woff", "ttf", "otf"].includes(ext)) {
      return NextResponse.json(
        { error: "Unsupported font format. Use .woff2, .woff, .ttf, or .otf" },
        { status: 400 }
      );
    }

    // Sanitize filename
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const bytes = await file.arrayBuffer();

    const sb = getSupabaseAdmin();

    // Upload to Supabase Storage bucket "fonts"
    // The bucket must exist in your Supabase project (create via dashboard or SQL)
    const { error } = await sb.storage
      .from("fonts")
      .upload(safeName, bytes, {
        contentType: file.type || "font/woff2",
        upsert: true, // overwrite if same filename uploaded again
      });

    if (error) throw error;

    // Get the public URL for the uploaded font
    const { data: urlData } = sb.storage.from("fonts").getPublicUrl(safeName);
    const publicUrl = urlData.publicUrl;

    return NextResponse.json({
      success: true,
      filename: safeName,
      url: publicUrl,
      format:
        ext === "woff2" ? "woff2"
        : ext === "woff" ? "woff"
        : ext === "ttf" ? "truetype"
        : "opentype",
    });
  } catch (err) {
    console.error("Font upload error:", err);
    return NextResponse.json({ error: "Upload failed: " + String(err) }, { status: 500 });
  }
}
