// ─── Pixel UI art ────────────────────────────────────────────────────────────
//
// The owner's pixel-art sheets for the page's controls — buttons, the cabinet
// bezel, the raffle ticket — cut by scripts/ui-art.mjs into
// public/popup/art/ui. ui.json is written by the same script and carries the
// measurements needed to stretch them without distorting the pixels.
//
// Everything here is drawn with `image-rendering: pixelated`, so the art stays
// hard-edged at whatever size the phone scales it to.

import { Press_Start_2P } from "next/font/google";
import type { CSSProperties } from "react";
import UI from "../../../../public/popup/art/ui/ui.json";

export { UI };

/** The arcade bitmap face every label on the page is set in. */
export const pixelFont = Press_Start_2P({ weight: "400", subsets: ["latin"], display: "swap" });

export const uiArt = (name: string) => `/popup/art/ui/${name}.png`;

export const PIXELATED: CSSProperties = { imageRendering: "pixelated" };

/** A background layer that fills its box with one piece of art. */
export function artLayer(name: string, size = "100% 100%"): CSSProperties {
  return {
    ...PIXELATED,
    backgroundImage: `url(${uiArt(name)})`,
    backgroundSize: size,
    backgroundRepeat: "no-repeat",
    backgroundPosition: "center",
  };
}

/**
 * Screen pixels per art pixel for the bezel. The sheet was drawn at 8 image
 * pixels to an art pixel, so 0.25 shows each one as a 2px block.
 */
const BEZEL_SCALE = 0.25;

/** How far inside the bezel content has to sit to clear its sides. */
export const BEZEL_INSET = Math.round(UI.frame.side * BEZEL_SCALE);

/**
 * The cabinet bezel, laid over whatever it frames.
 *
 * A nine-slice border image: the corners keep their screws and steps, the
 * sides stretch. Sits above the content and ignores the pointer, so content
 * just needs BEZEL_INSET of padding to show through the opening.
 */
export function BezelFrame({ glow }: { glow?: string }) {
  const slice = UI.frame.slice;
  const width = Math.round(slice * BEZEL_SCALE);
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 z-30"
      style={{
        ...PIXELATED,
        borderStyle: "solid",
        borderWidth: width,
        borderImageSource: `url(${uiArt("bezel")})`,
        borderImageSlice: slice,
        borderImageWidth: `${width}px`,
        borderImageRepeat: "stretch",
        filter: glow ? `drop-shadow(0 0 14px ${glow}66)` : undefined,
      }}
    />
  );
}
