// All brand colors available for text color selection in the admin editor.
// Organized so the picker shows them in a readable grid.

export interface BrandColor {
  label: string;
  hex: string;
  theme?: string;  // which theme group it belongs to
}

export const BRAND_COLORS: BrandColor[] = [
  // ─── Special ──────────────────────────────────────────────────────────────
  { label: "Accent / CTA",   hex: "#C97D5A"              },
  { label: "White",          hex: "#FFFFFF"              },
  { label: "Cream",          hex: "#F5F0E8"              },
  { label: "Dark Olive",     hex: "#1A1F17"              },
  { label: "Mid Olive",      hex: "#2a3020"              },

  // ─── Olive (header / home) ────────────────────────────────────────────────
  { label: "Olive Text",     hex: "#8A9A78",  theme: "Olive"      },
  { label: "Olive Muted",    hex: "#5a6a4a",  theme: "Olive"      },
  { label: "Olive Dark",     hex: "#1A1F17",  theme: "Olive"      },

  // ─── Forest Green ─────────────────────────────────────────────────────────
  { label: "Green Text",     hex: "#A8C4A0",  theme: "Green"      },
  { label: "Green Muted",    hex: "#6a8a72",  theme: "Green"      },
  { label: "Green Dark",     hex: "#3B5040",  theme: "Green"      },

  // ─── Golden Amber ─────────────────────────────────────────────────────────
  { label: "Amber Text",     hex: "#D4B870",  theme: "Amber"      },
  { label: "Amber Muted",    hex: "#a08030",  theme: "Amber"      },
  { label: "Amber Dark",     hex: "#866515",  theme: "Amber"      },

  // ─── Terracotta ───────────────────────────────────────────────────────────
  { label: "Terra Text",     hex: "#D4A898",  theme: "Terracotta" },
  { label: "Terra Muted",    hex: "#b07868",  theme: "Terracotta" },
  { label: "Terra Dark",     hex: "#9D5242",  theme: "Terracotta" },

  // ─── Deep Plum ────────────────────────────────────────────────────────────
  { label: "Plum Text",      hex: "#C0A0C8",  theme: "Plum"       },
  { label: "Plum Muted",     hex: "#8a6892",  theme: "Plum"       },
  { label: "Plum Dark",      hex: "#4E3456",  theme: "Plum"       },

  // ─── Dark Teal ────────────────────────────────────────────────────────────
  { label: "Teal Text",      hex: "#90B8BC",  theme: "Teal"       },
  { label: "Teal Muted",     hex: "#5a8a8e",  theme: "Teal"       },
  { label: "Teal Dark",      hex: "#2F4A4E",  theme: "Teal"       },

  // ─── Steel Blue ───────────────────────────────────────────────────────────
  { label: "Blue Text",      hex: "#90A8C8",  theme: "Blue"       },
  { label: "Blue Muted",     hex: "#5a72a0",  theme: "Blue"       },
  { label: "Blue Dark",      hex: "#364260",  theme: "Blue"       },
];

// Groups for rendering the picker in rows
export const COLOR_GROUPS = [
  { label: "Special",     colors: BRAND_COLORS.slice(0, 5)   },
  { label: "Olive",       colors: BRAND_COLORS.slice(5, 8)   },
  { label: "Green",       colors: BRAND_COLORS.slice(8, 11)  },
  { label: "Amber",       colors: BRAND_COLORS.slice(11, 14) },
  { label: "Terracotta",  colors: BRAND_COLORS.slice(14, 17) },
  { label: "Plum",        colors: BRAND_COLORS.slice(17, 20) },
  { label: "Teal",        colors: BRAND_COLORS.slice(20, 23) },
  { label: "Blue",        colors: BRAND_COLORS.slice(23, 26) },
];
