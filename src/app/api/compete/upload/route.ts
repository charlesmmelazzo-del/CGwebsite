import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";
import { getSupabaseAdmin } from "@/lib/supabase";
import { getContestantByToken, getEventById, getSponsorByToken, submissionLocked } from "@/lib/compete/data";
import { isAdminRequest } from "@/lib/compete/session";

export const dynamic = "force-dynamic";

const BUCKET = "images";
const MAX_MB = 15;
const RASTER = ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif"];

/**
 * POST multipart { file, kind, token, eventId? } — photo uploads from the
 * contestant and partner links (authorised by their token) or the admin panel.
 *
 * Photos are resized to 2000px and re-encoded as WebP so guests' phones load
 * them quickly in a crowded bar. SVG is accepted only for partner logos.
 */
export async function POST(req: NextRequest) {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid upload." }, { status: 400 });
  }
  const file = form.get("file");
  const kind = String(form.get("kind") ?? "");
  const token = String(form.get("token") ?? "");
  if (!(file instanceof File)) return NextResponse.json({ error: "No file provided." }, { status: 400 });
  if (file.size > MAX_MB * 1024 * 1024) {
    return NextResponse.json({ error: `That file is too large. The limit is ${MAX_MB} MB.` }, { status: 400 });
  }

  let eventId = "";
  if (kind === "contestant") {
    const c = await getContestantByToken(token);
    const ev = c && (await getEventById(c.eventId));
    if (!c || !ev || submissionLocked(c, ev.contestantDeadline)) {
      return NextResponse.json({ error: "This link can’t accept uploads." }, { status: 403 });
    }
    eventId = ev.id;
  } else if (kind === "partner") {
    const s = await getSponsorByToken(token);
    const ev = s && (await getEventById(s.eventId));
    if (!s || !ev || submissionLocked(s, ev.partnerDeadline)) {
      return NextResponse.json({ error: "This link can’t accept uploads." }, { status: 403 });
    }
    eventId = ev.id;
  } else if (kind === "admin") {
    if (!(await isAdminRequest(req))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    eventId = String(form.get("eventId") ?? "admin");
  } else {
    return NextResponse.json({ error: "Invalid upload." }, { status: 400 });
  }

  const isSvg = file.type === "image/svg+xml";
  if (isSvg ? kind === "contestant" : !RASTER.includes(file.type)) {
    return NextResponse.json(
      { error: /hei[cf]/i.test(file.type) ? "That’s an iPhone HEIC photo — please choose “Most Compatible” or send a JPG." : "Please upload a JPG, PNG, or WebP image." },
      { status: 400 }
    );
  }

  const input = Buffer.from(await file.arrayBuffer());
  let body: Buffer;
  let contentType: string;
  let ext: string;
  try {
    if (isSvg) {
      body = input;
      contentType = "image/svg+xml";
      ext = "svg";
    } else {
      body = await sharp(input)
        .rotate()
        .resize({ width: 2000, height: 2000, fit: "inside", withoutEnlargement: true })
        .webp({ quality: 82 })
        .toBuffer();
      contentType = "image/webp";
      ext = "webp";
    }
  } catch {
    return NextResponse.json({ error: "We couldn’t read that image. Please try a JPG or PNG." }, { status: 400 });
  }

  const path = `compete/${eventId.replace(/[^a-z0-9-]/gi, "")}/${randomUUID()}.${ext}`;
  const sb = getSupabaseAdmin();
  const { error } = await sb.storage.from(BUCKET).upload(path, body, { contentType, upsert: false });
  if (error) {
    console.error("[compete/upload]", error);
    return NextResponse.json({ error: "Upload failed. Please try again." }, { status: 500 });
  }
  const { data } = sb.storage.from(BUCKET).getPublicUrl(path);
  return NextResponse.json({ url: data.publicUrl });
}
