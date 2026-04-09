export type ThemeName =
  | "olive"
  | "green"
  | "amber"
  | "terracotta"
  | "plum"
  | "teal"
  | "blue";

export interface Theme {
  name: ThemeName;
  label: string;
  bg: string;
  text: string;
  muted: string;
  illustration?: string; // path to background illustration
}

export const THEMES: Record<ThemeName, Theme> = {
  olive: {
    name: "olive",
    label: "Dark Olive",
    bg: "#1A1F17",
    text: "#8A9A78",
    muted: "#5a6a4a",
  },
  green: {
    name: "green",
    label: "Forest Green",
    bg: "#3B5040",
    text: "#A8C4A0",
    muted: "#6a8a72",
  },
  amber: {
    name: "amber",
    label: "Golden Amber",
    bg: "#866515",
    text: "#D4B870",
    muted: "#a08030",
  },
  terracotta: {
    name: "terracotta",
    label: "Terracotta",
    bg: "#9D5242",
    text: "#D4A898",
    muted: "#b07868",
  },
  plum: {
    name: "plum",
    label: "Deep Plum",
    bg: "#4E3456",
    text: "#C0A0C8",
    muted: "#8a6892",
  },
  teal: {
    name: "teal",
    label: "Dark Teal",
    bg: "#2F4A4E",
    text: "#90B8BC",
    muted: "#5a8a8e",
  },
  blue: {
    name: "blue",
    label: "Steel Blue",
    bg: "#364260",
    text: "#90A8C8",
    muted: "#5a72a0",
  },
};

// Themes used for random page rotation (excludes olive — that's header/home)
export const PAGE_THEMES: ThemeName[] = [
  "green",
  "amber",
  "terracotta",
  "plum",
  "teal",
  "blue",
];

export function getRandomTheme(excludeCurrent?: ThemeName): ThemeName {
  const pool = PAGE_THEMES.filter((t) => t !== excludeCurrent);
  return pool[Math.floor(Math.random() * pool.length)];
}

export function getTheme(name: ThemeName): Theme {
  return THEMES[name];
}

// Header/footer always use dark olive
export const HEADER_THEME: Theme = THEMES.olive;
