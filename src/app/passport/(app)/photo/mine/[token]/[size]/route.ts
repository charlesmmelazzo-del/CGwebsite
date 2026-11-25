import type { NextRequest } from "next/server";
import { isSize, notFoundPhoto, photoResponse } from "@/lib/passport/photoRoute";

export const dynamic = "force-dynamic";

/** File 11: one of the signed-in member's own photos (anyone else's is "Not found"). Never stored by any cache. */
export async function GET(req: NextRequest, { params }: { params: { token: string; size: string } }) {
  if (!/^[a-f0-9]{24}$/.test(params.token) || !isSize(params.size)) return notFoundPhoto();
  return photoResponse(req, `/photos/mine/${params.token}/${params.size}`, "private, no-store");
}
