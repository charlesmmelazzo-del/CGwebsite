/* eslint-disable @next/next/no-img-element -- Passport photos come through the member's own signed-in route, never the image optimizer (it would fetch and cache them without the member's sign-in). */
import type { CSSProperties } from "react";
import { C, LOGO_PANEL, logoAlt } from "./theme";
import { barPhotoSrc, type ItemKind } from "@/lib/passport/types";

/**
 * File 11: the bar's photo on an item page, and a small one on cards. Only drawn when the bar has one, so a page
 * without a photo reads as complete rather than missing something. Shared by server pages and client tabs (no hooks).
 *
 * File 15, Part C: no stark white boxes. Every photo sits on the app's dark tint. A bottle is portrait, so a bottle's
 * photo is shown whole (contain-fit), never cropped; a photo with a transparent background ("clear") is drawn without a
 * box, contain-fit with a little padding; a cocktail's ordinary photo fills its box as before (cover-fit).
 *
 * File 17: a brand logo (no bottle photo yet) is never drawn on the dark tint, where dark lettering would vanish. It
 * sits on a light cream panel (LOGO_PANEL, the public site's #F5F0E8) with the photo box's rounded corners, contain-fit
 * inside about 15% padding on every side, never cropped or stretched, in a box of fixed size (no layout shift).
 */
export const photoFit = (kind: ItemKind, clear?: boolean): { className: string; style: CSSProperties } =>
  clear || kind === "bottle"
    ? { className: "object-contain", style: { padding: clear ? "8%" : "4%", background: "transparent" } }
    : { className: "object-cover", style: { background: C.card } };

/**
 * A brand logo on its light panel. `size` fixes a square box in pixels; without it the box takes its shape from
 * `className` (e.g. "w-full aspect-square"). The logo fills the middle 70% of the box (15% padding each side).
 */
export function LogoImg({ src, alt, size, className = "", eager = false, rounded = "rounded-md" }: { src: string; alt: string; size?: number; className?: string; eager?: boolean; rounded?: string }) {
  return (
    <span className={`relative block shrink-0 overflow-hidden ${rounded} ${className}`} style={{ background: LOGO_PANEL, ...(size ? { width: size, height: size } : {}) }} data-logo="1">
      <img src={src} alt={alt} loading={eager ? "eager" : "lazy"} decoding="async" {...(size ? { width: size, height: size } : {})}
        className="absolute object-contain" style={{ left: "15%", top: "15%", width: "70%", height: "70%" }} />
    </span>
  );
}

export function BarPhoto({ kind, id, photo, alt, name, clear, credit, logo, producer }: { kind: ItemKind; id: number; photo?: string | null; alt?: string; name: string; clear?: boolean; credit?: string; logo?: boolean; producer?: string }) {
  if (!photo) return null;
  if (logo && kind === "bottle") {
    // File 17: a smaller logo panel in place of the tall bottle hero.
    return (
      <figure className="mt-5">
        <LogoImg src={barPhotoSrc(kind, id, photo, "full")} alt={logoAlt(name, producer)} eager rounded="rounded-lg" className="w-full max-w-[420px] aspect-[2/1]" />
        {credit && <figcaption className="pp-t-secondary pt-1.5 pb-1" style={{ color: C.faint, fontSize: "0.75rem" }}>Logo: {credit}</figcaption>}
      </figure>
    );
  }
  const fit = photoFit(kind, clear);
  return (
    <figure className="mt-5 -mx-5 sm:mx-0" style={{ background: kind === "bottle" || clear ? "#1F251A" : C.card }}>
      <img src={barPhotoSrc(kind, id, photo, "full")} alt={alt || `${name}, photographed at Common Good`} loading="eager" decoding="async"
        className={`w-full aspect-[4/3] sm:rounded-lg ${fit.className}`} style={fit.style} />
      {credit && <figcaption className="pp-t-secondary px-5 sm:px-0 pt-1.5 pb-1" style={{ color: C.faint, fontSize: "0.75rem" }}>Photo: {credit}</figcaption>}
    </figure>
  );
}

/** A small square photo at the start of a card (Menu, Index, lists). Nothing when there is no photo. */
export function Thumb({ kind, id, photo, size = 44, clear, logo, name }: { kind: ItemKind; id: number | null | undefined; photo?: string | null; size?: number; clear?: boolean; logo?: boolean; name?: string }) {
  if (!photo || !id) return null;
  if (logo && kind === "bottle") return <LogoImg src={barPhotoSrc(kind, id, photo, "thumb")} alt={name ? logoAlt(name) : ""} size={size} />;
  const fit = photoFit(kind, clear);
  return (
    <img src={barPhotoSrc(kind, id, photo, "thumb")} alt="" aria-hidden loading="lazy" decoding="async" width={size} height={size}
      className={`shrink-0 rounded-md ${fit.className}`} style={{ width: size, height: size, ...fit.style, background: "#1F251A" }} />
  );
}
