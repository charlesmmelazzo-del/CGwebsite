// Font roles define which CSS variable each admin-assigned font controls.
// These are the "slots" shown in the font manager assignment panel.

export interface FontRole {
  id: string;
  label: string;
  cssVar: string;
  description: string;
  currentDefault: string;  // what it falls back to without a custom font
}

export const FONT_ROLES: FontRole[] = [
  {
    id: "display",
    label: "Headings & Titles",
    cssVar: "--font-display",
    description: "Page headings, section titles, display text",
    currentDefault: "KorinthSerial → Cormorant Garamond",
  },
  {
    id: "body",
    label: "Body & Paragraphs",
    cssVar: "--font-body",
    description: "Body copy, descriptions, general paragraph text",
    currentDefault: "Futura → Jost",
  },
  {
    id: "nav",
    label: "Navigation Links",
    cssVar: "--font-nav",
    description: "Header navigation links, page tab labels",
    currentDefault: "Inherits Body font",
  },
  {
    id: "button",
    label: "Buttons & CTAs",
    cssVar: "--font-button",
    description: "Button labels, call-to-action text, form submit buttons",
    currentDefault: "Inherits Body font",
  },
  {
    id: "label",
    label: "Labels & Captions",
    cssVar: "--font-label",
    description: "Small uppercase labels, price tags, meta captions",
    currentDefault: "Inherits Body font",
  },
];

export type FontRoleId = typeof FONT_ROLES[number]["id"];

// What assignments look like in storage
export interface FontAssignments {
  display?: string | null;  // font family name (CSS)
  body?: string | null;
  nav?: string | null;
  button?: string | null;
  label?: string | null;
}
