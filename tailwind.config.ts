import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Core brand themes — each is a background + text pair
        "theme-olive": {
          bg: "#1A1F17",
          text: "#8A9A78",
          muted: "#5a6a4a",
        },
        "theme-green": {
          bg: "#3B5040",
          text: "#A8C4A0",
          muted: "#6a8a72",
        },
        "theme-amber": {
          bg: "#866515",
          text: "#D4B870",
          muted: "#a08030",
        },
        "theme-terracotta": {
          bg: "#9D5242",
          text: "#D4A898",
          muted: "#b07868",
        },
        "theme-plum": {
          bg: "#4E3456",
          text: "#C0A0C8",
          muted: "#8a6892",
        },
        "theme-teal": {
          bg: "#2F4A4E",
          text: "#90B8BC",
          muted: "#5a8a8e",
        },
        "theme-blue": {
          bg: "#364260",
          text: "#90A8C8",
          muted: "#5a72a0",
        },
        // Accent / CTA
        accent: "#C97D5A",
        "accent-hover": "#b86d4a",
        // Header/footer — dark olive always
        header: "#1A1F17",
        "header-text": "#8A9A78",
        footer: "#1A1F17",
        "footer-text": "#8A9A78",
      },
      fontFamily: {
        // font-display → KorinthSerial → Cormorant Garamond fallback
        display: ["KorinthSerial", "var(--font-korinth-fallback)", "Georgia", "serif"],
        // font-body → Futura → Jost fallback
        body: ["Futura", "var(--font-futura-fallback)", "system-ui", "sans-serif"],
      },
      letterSpacing: {
        widest: "0.25em",
        "ultra-wide": "0.35em",
      },
      animation: {
        "fade-in": "fadeIn 0.5s ease-in-out",
        "slide-up": "slideUp 0.4s ease-out",
        "slide-in-right": "slideInRight 0.4s ease-out",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideUp: {
          "0%": { opacity: "0", transform: "translateY(20px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        slideInRight: {
          "0%": { opacity: "0", transform: "translateX(20px)" },
          "100%": { opacity: "1", transform: "translateX(0)" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
