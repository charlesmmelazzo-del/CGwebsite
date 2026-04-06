import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

const BUCKET = "images";

// GET — list all images in the bucket
export async function GET() {
  try {
    const sb = getSupabaseAdmin();
    const { data, error } = await sb.storage.from(BUCKET).list("", {
      limit: 500,
      sortBy: { column: "created_at", order: "desc" },
    });
    if (error) throw error;

    const files = (data ?? [])
      .filter((f) => f.name !== ".emptyFolderPlaceholder")
      .map((f) => {
        const { data: urlData } = sb.storage.from(BUCKET).getPublicUrl(f.name);
        return {
          name: f.name,
          url: urlData.publicUrl,
          size: f.metadata?.size ?? 0,
          createdAt: f.created_at,
          mimeType: f.metadata?.mimetype ?? "image/*",
        };
      });

    return NextResponse.json({ files });
  } catch (e) {
    console.error("[GET /api/admin/images]", e);
    return NextResponse.json({ files: [] });
  }
}

// DELETE — remove an image by storage path (filename)
export async function DELETE(req: NextRequest) {
  try {
    const { path } = await req.json();
    if (!path) return NextResponse.json({ success: false, error: "path required" }, { status: 400 });

    const sb = getSupabaseAdmin();
    const { error } = await sb.storage.from(BUCKET).remove([path]);
    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("[DELETE /api/admin/images]", e);
    return NextResponse.json({ success: false, error: String(e) }, { status: 500 });
  }
}
