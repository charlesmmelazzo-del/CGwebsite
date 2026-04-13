"use client";

import { useState } from "react";
import { THEMES, type ThemeName } from "@/lib/themes";

const PRESETS: { name: ThemeName; label: string; bg: string; text: string; muted: string }[] = [
  { name: "olive",      label: "Dark Olive",   bg: "#1A1F17", text: "#8A9A78", muted: "#5a6a4a" },
  { name: "green",      label: "Forest",       bg: "#3B5040", text: "#A8C4A0", muted: "#6a8a72" },
  { name: "amber",      label: "Amber",        bg: "#866515", text: "#D4B870", muted: "#a08030" },
  { name: "terracotta", label: "Terracotta",   bg: "#9D5242", text: "#D4A898", muted: "#b07868" },
  { name: "plum",       label: "Plum",         bg: "#4E3456", text: "#C0A0C8", muted: "#8a6892" },
  { name: "teal",       label: "Teal",         bg: "#2F4A4E", text: "#90B8BC", muted: "#5a8a8e" },
  { name: "blue",       label: "Steel Blue",   bg: "#364260", text: "#90A8C8", muted: "#5a72a0" },
];

interface ThemeEditorProps {
  theme?: ThemeName;
  customBg?: string;
  customText?: string;
  customMuted?: string;
  onChange: (updates: {
    theme?: ThemeName;
    customBg?: string;
    customText?: string;
    customMuted?: string;
  }) => void;
}

export default function ThemeEditor({
  theme,
  customBg,
  customText,
  customMuted,
  onChange,
}: ThemeEditorProps) {
  const base = THEMES[theme ?? "olive"];
  const displayBg    = customBg    ?? base.bg;
  const displayText  = customText  ?? base.text;
  const displayMuted = customMuted ?? base.muted;

  function applyPreset(p: typeof PRESETS[number]) {
    onChange({ theme: p.name, customBg: p.bg, customText: p.text, customMuted: p.muted });
  }

  function isValidHex(v: string) {
    return /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(v);
  }

  function handleHexBlur(field: "customBg" | "customText" | "customMuted", raw: string) {
    let v = raw.trim();
    if (v && !v.startsWith("#")) v = "#" + v;
    if (v === "" || isValidHex(v)) onChange({ [field]: v || undefined });
  }

  return (
    <div className="space-y-5">
      {/* Preset row */}
      <div>
        <p className="text-[10px] tracking-widest uppercase text-gray-400 mb-2">Start from a preset</p>
        <div className="flex flex-wrap gap-3">
          {PRESETS.map((p) => {
            const isActive = displayBg === p.bg && displayText === p.text && displayMuted === p.muted;
            return (
              <button
                key={p.name}
                onClick={() => applyPreset(p)}
                title={p.label}
                className="flex flex-col items-center gap-1.5"
              >
                <div
                  className="w-9 h-9 rounded-full transition-all duration-150"
                  style={{
                    backgroundColor: p.bg,
                    outline: isActive ? "3px solid #C97D5A" : "2px solid transparent",
                    outlineOffset: "2px",
                  }}
                />
                <p
                  className="text-[9px] tracking-wider uppercase"
                  style={{ color: isActive ? "#C97D5A" : "#9ca3af" }}
                >
                  {p.label}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Per-color pickers */}
      <div className="space-y-3">
        <p className="text-[10px] tracking-widest uppercase text-gray-400">Customize each color</p>
        <ColorField
          label="Background"
          value={displayBg}
          onChange={(hex) => onChange({ customBg: hex })}
          onBlur={(raw) => handleHexBlur("customBg", raw)}
        />
        <ColorField
          label="Text"
          value={displayText}
          onChange={(hex) => onChange({ customText: hex })}
          onBlur={(raw) => handleHexBlur("customText", raw)}
        />
        <ColorField
          label="Muted / Secondary"
          value={displayMuted}
          onChange={(hex) => onChange({ customMuted: hex })}
          onBlur={(raw) => handleHexBlur("customMuted", raw)}
        />
      </div>

      {/* Live preview */}
      <div>
        <p className="text-[10px] tracking-widest uppercase text-gray-400 mb-2">Preview</p>
        <div className="rounded-lg p-5 border border-gray-200" style={{ backgroundColor: displayBg }}>
          <p
            className="text-lg tracking-widest uppercase mb-1"
            style={{ color: displayText, fontFamily: "var(--font-display)" }}
          >
            Sample Heading
          </p>
          <p className="text-sm" style={{ color: displayText }}>
            This is how your page text will look.
          </p>
          <p className="text-xs mt-2" style={{ color: displayMuted }}>
            Secondary text and dividers use the muted color.
          </p>
          <div className="w-12 h-px mt-3" style={{ backgroundColor: displayMuted }} />
        </div>
      </div>
    </div>
  );
}

/* ─── Single color row: wheel + hex input + swatch ──────────────────── */

function ColorField({
  label,
  value,
  onChange,
  onBlur,
}: {
  label: string;
  value: string;
  onChange: (hex: string) => void;
  onBlur: (raw: string) => void;
}) {
  const [inputVal, setInputVal] = useState(value);
  // Sync text input when value changes externally (e.g. preset click)
  const [prevValue, setPrevValue] = useState(value);
  if (value !== prevValue) {
    setInputVal(value);
    setPrevValue(value);
  }

  return (
    <div className="flex items-center gap-3">
      <label className="w-28 text-[10px] tracking-widest uppercase text-gray-500 shrink-0">
        {label}
      </label>

      {/* Native color wheel */}
      <input
        type="color"
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setInputVal(e.target.value);
        }}
        className="w-9 h-9 rounded cursor-pointer border border-gray-200 bg-transparent p-0.5 shrink-0"
      />

      {/* Hex text input */}
      <input
        type="text"
        value={inputVal}
        onChange={(e) => setInputVal(e.target.value)}
        onBlur={() => onBlur(inputVal)}
        onKeyDown={(e) => { if (e.key === "Enter") onBlur(inputVal); }}
        placeholder="#000000"
        maxLength={7}
        className="w-24 bg-gray-50 border border-gray-200 text-gray-700 text-sm px-2 py-1.5 outline-none focus:border-[#C97D5A]/50 rounded-sm font-mono"
      />

      {/* Preview swatch */}
      <div
        className="w-6 h-6 rounded-sm border border-gray-200 shrink-0"
        style={{ backgroundColor: value }}
      />
    </div>
  );
}
