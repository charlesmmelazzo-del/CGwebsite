import { NextRequest, NextResponse } from "next/server";
import { writeFileSync, existsSync, mkdirSync } from "fs";
import path from "path";

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
      return NextResponse.json({ error: "Unsupported font format. Use .woff2, .woff, .ttf, or .otf" }, { status: 400 });
    }

    // Sanitize filename
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const fontsDir = path.join(process.cwd(), "public", "fonts");

    if (!existsSync(fontsDir)) mkdirSync(fontsDir, { recursive: true });

    const destPath = path.join(fontsDir, safeName);
    const bytes = await file.arrayBuffer();
    writeFileSync(destPath, Buffer.from(bytes));

    return NextResponse.json({
      success: true,
      filename: safeName,
      url: `/fonts/${safeName}`,
      format: ext === "woff2" ? "woff2" : ext === "woff" ? "woff" : ext === "ttf" ? "truetype" : "opentype",
    });
  } catch (err) {
    console.error("Font upload error:", err);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
