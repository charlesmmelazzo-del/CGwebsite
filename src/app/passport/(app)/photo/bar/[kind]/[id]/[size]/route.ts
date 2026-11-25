import type { NextRequest } from "next/server";
import { isPhotoKind, isSize, notFoundPhoto, photoResponse } from "@/lib/passport/photoRoute";

export const dynamic = "force-dynamic";

/**
 * File 11: the bar's photo of a cocktail or bottle, for a signed-in member who may open it. Its address carries the
 * photo's version code (?v=), so it can stay in the member's own browser cache; a new photo gets a new address.
 * Private: never kept by a shared cache.
 */
export async function GET(req: NextRequest, { params }: { params: { kind: string; id: string; size: string } }) {
  const id = Number(params.id);
  if (!isPhotoKind(params.kind) || !isSize(params.size) || !Number.isInteger(id) || id <= 0 || id > 1e9) return notFoundPhoto();
  return photoResponse(req, `/photos/bar/${params.kind}/${id}/${params.size}`, "private, max-age=31536000, immutable");
}
