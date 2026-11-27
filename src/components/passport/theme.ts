/** Passport colors, shared by server and client components. */
export const C = {
  bg: "#13170F",
  card: "#1B2016",
  line: "#323B29",
  text: "#EDE6D3",
  muted: "#97A586",
  // File 12: raised from #6B7860 (3.9:1) to pass WCAG AA for small text on the background (5.5:1) and on cards (5.0:1).
  faint: "#859277",
  brass: "#C9A96E",
  accent: "#C97D5A",
};
/**
 * File 17: the light panel a brand logo sits on (never the dark tint: dark lettering would vanish). The public site's
 * light cream (#F5F0E8, accents.ts "cream"), with the photo box's rounded corners; the logo contain-fit with about 15%
 * padding each side, never cropped or stretched.
 */
export const LOGO_PANEL = "#F5F0E8";
export const LOGO_PAD = "15%";
/** Alt text for a brand logo: "{brand} logo" (the producer when known, else the bottle's own name). */
export const logoAlt = (name: string, producer?: string | null) => `${(producer || name).trim()} logo`;
