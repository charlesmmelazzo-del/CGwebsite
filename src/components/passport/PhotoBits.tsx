/* eslint-disable @next/next/no-img-element -- Passport photos come through the member's own signed-in route, never the image optimizer (it would fetch and cache them without the member's sign-in). */
import { C } from "./theme";
import { barPhotoSrc, type ItemKind } from "@/lib/passport/types";

/**
 * File 11: the bar's photo on an item page, and a small one on cards. Only drawn when the bar has one, so a page
 * without a photo reads as complete rather than missing something. Shared by server pages and client tabs (no hooks).
 */
export function BarPhoto({ kind, id, photo, alt, name }: { kind: ItemKind; id: number; photo?: string | null; alt?: string; name: string }) {
  if (!photo) return null;
  return (
    <figure className="mt-5 -mx-5 sm:mx-0">
      <img src={barPhotoSrc(kind, id, photo, "full")} alt={alt || `${name}, photographed at Common Good`} loading="eager" decoding="async"
        className="w-full aspect-[4/3] object-cover sm:rounded-lg" style={{ background: C.card }} />
    </figure>
  );
}

/** A small square photo at the start of a card (Menu, Index, lists). Nothing when there is no photo. */
export function Thumb({ kind, id, photo, size = 44 }: { kind: ItemKind; id: number | null | undefined; photo?: string | null; size?: number }) {
  if (!photo || !id) return null;
  return (
    <img src={barPhotoSrc(kind, id, photo, "thumb")} alt="" aria-hidden loading="lazy" decoding="async" width={size} height={size}
      className="shrink-0 rounded-md object-cover" style={{ width: size, height: size, background: C.card }} />
  );
}
