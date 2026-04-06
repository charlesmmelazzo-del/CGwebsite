"use client";

// FontLoader — reads admin font assignments and injects @font-face + CSS variable
// overrides into the document at runtime. Runs once on initial page load.

import { useEffect } from "react";

interface FontFile {
  url: string;
  weight: string;
  style: "normal" | "italic";
  format: string;
}

interface FontEntry {
  id: string;
  family: string;
  files: FontFile[];
}

interface FontData {
  fonts: FontEntry[];
  assignments: Record<string, string | null>;
}

// Maps role id → CSS variable name
const ROLE_VAR: Record<string, string> = {
  display: "--font-display",
  body:    "--font-body",
  nav:     "--font-nav",
  button:  "--font-button",
  label:   "--font-label",
};

export default function FontLoader() {
  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/admin/fonts", { cache: "no-store" });
        if (!res.ok) return;
        const data: FontData = await res.json();
        if (!data.fonts?.length && !Object.values(data.assignments ?? {}).some(Boolean)) return;

        let css = "";

        // Inject @font-face for every uploaded font + variant
        for (const font of data.fonts) {
          for (const file of font.files) {
            css += `
@font-face {
  font-family: '${font.family}';
  src: url('${file.url}') format('${file.format}');
  font-weight: ${file.weight};
  font-style: ${file.style};
  font-display: swap;
}`;
          }
        }

        // Override CSS variables for assigned roles
        const varOverrides: string[] = [];
        for (const [role, family] of Object.entries(data.assignments ?? {})) {
          if (family && ROLE_VAR[role]) {
            varOverrides.push(`  ${ROLE_VAR[role]}: '${family}', sans-serif;`);
          }
        }
        if (varOverrides.length) {
          css += `\n:root {\n${varOverrides.join("\n")}\n}`;
        }

        if (!css.trim()) return;

        // Inject or update a single <style> tag
        const existing = document.getElementById("cg-font-loader");
        if (existing) {
          existing.textContent = css;
        } else {
          const style = document.createElement("style");
          style.id = "cg-font-loader";
          style.textContent = css;
          document.head.appendChild(style);
        }
      } catch {
        // Fail silently — fonts just fall back to defaults
      }
    }
    load();
  }, []);

  return null;
}
