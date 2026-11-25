import { NextResponse, type NextRequest } from "next/server";
import { deleteMyPhoto, getItemPhotos, getMyPhotos, uploadPhoto } from "@/lib/passport/bible";
import { currentAuth } from "@/lib/passport/session";
import { bad, fromError, isKind, limited, memberRequest, posInt, sameOrigin, text } from "@/lib/passport/route";

export const dynamic = "force-dynamic";

const MAX_BYTES = 15 * 1024 * 1024;

/**
 * File 11: the signed-in member's own photos. GET ?kind=&id= is one item's (with what they may still add); GET alone is
 * "My photos". POST adds one (a form with kind, id, an optional caption and the photo, already shrunk on the phone);
 * the Bible checks the item, the caps and the photo's real content, and saves it fresh. DELETE removes one of theirs.
 */
export async function GET(req: NextRequest) {
  return memberRequest(req, "passport-photo-read", async (auth) => {
    const q = req.nextUrl.searchParams;
    if (!q.has("kind")) return getMyPhotos(auth);
    const kind = q.get("kind");
    const id = posInt(q.get("id"));
    if (!isKind(kind) || !id) return bad("Something is missing.");
    return getItemPhotos(auth, kind, id);
  });
}

export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  const stop = limited(req, "passport-photos");
  if (stop) return stop;
  const auth = currentAuth();
  if (!auth) return NextResponse.json({ error: "Please sign in again.", signed_out: true }, { status: 401 });
  const size = Number(req.headers.get("content-length") || 0);
  if (size > MAX_BYTES + 64 * 1024) return NextResponse.json({ error: "That photo is over 15 MB. Please choose a smaller one." }, { status: 413 });
  let form: FormData;
  try { form = await req.formData(); } catch { return bad("Choose a photo first."); }
  const kind = form.get("kind");
  const id = posInt(form.get("id"));
  const file = form.get("photo");
  const caption = text(form.get("caption"), 121).replace(/\s+/g, " ").trim();
  if (!isKind(kind) || !id) return bad("Something is missing.");
  if (!file || typeof file === "string") return bad("Choose a photo first.");
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "That photo is over 15 MB. Please choose a smaller one." }, { status: 413 });
  if (caption.length > 120) return bad("Keep the caption under 120 characters.");
  try {
    const out = await uploadPhoto(auth, kind, id, await file.arrayBuffer(), caption);
    return NextResponse.json(out, { status: 201 });
  } catch (e) {
    return fromError(e, { req, bucket: "passport-photos" });
  }
}

export async function DELETE(req: NextRequest) {
  return memberRequest(req, "passport-photos", async (auth, b) => {
    const token = typeof b.id === "string" && /^[a-f0-9]{24}$/.test(b.id) ? b.id : null;
    if (!token) return bad("Something is missing.");
    return deleteMyPhoto(auth, token);
  });
}
