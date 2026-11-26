import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { getPhotoBytes } from "./bible";
import { currentAuth } from "./session";
import { limited } from "./route";

/**
 * File 11: a photo for the signed-in member, straight from the Bible through the Passport connection. Never at a public
 * address: no sign-in, no photo. The Bible decides whose photo it is (the member's own) and whether the member may open
 * the item (the bar's). Only a fresh JPEG made by the Bible is ever sent on (file 15: or, for a bar photo with a
 * transparent background, a fresh WebP the Bible made; nothing else, never an SVG).
 */
export const PHOTO_TYPES = ["image/jpeg", "image/webp"];
const toSignIn = () => new NextResponse(null, { status: 307, headers: { Location: "/passport", "Cache-Control": "private, no-store" } });
const notFound = () => new NextResponse("Not found", { status: 404, headers: { "Cache-Control": "private, no-store" } });

export async function photoResponse(req: NextRequest, path: string, cache: string): Promise<NextResponse> {
  const auth = currentAuth();
  if (!auth) return toSignIn();
  const stop = limited(req, "passport-photo-read");
  if (stop) return stop;
  const res = await getPhotoBytes(auth, path);
  if (!res) return new NextResponse("Passport is unavailable right now.", { status: 503, headers: { "Cache-Control": "private, no-store" } });
  if (res.status === 401) return toSignIn();
  const type = (res.headers.get("content-type") || "").split(";")[0].trim();
  if (!res.ok || !PHOTO_TYPES.includes(type)) return notFound();
  return new NextResponse(res.body, {
    status: 200,
    headers: { "Content-Type": type, "Cache-Control": cache, "X-Content-Type-Options": "nosniff", "Content-Security-Policy": "default-src 'none'", "Cross-Origin-Resource-Policy": "same-origin" },
  });
}

export const isPhotoKind = (v: string): v is "cocktail" | "bottle" => v === "cocktail" || v === "bottle";
export const isSize = (v: string): v is "thumb" | "full" => v === "thumb" || v === "full";
export const notFoundPhoto = notFound;
