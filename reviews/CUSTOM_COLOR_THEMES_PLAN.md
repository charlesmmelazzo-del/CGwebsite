# Admin-Editable Color Themes — Color Wheel + Hex Input

**For:** Claude Code  
**Scope:** Replace the fixed 7-theme system with fully customizable themes. Admin picks a main color (via color wheel or hex input), then sets complementary text and muted colors. Each page can have its own custom palette.

---

## Current system (what we're replacing)

- 7 hardcoded themes in `src/lib/themes.ts` (`olive`, `green`, `amber`, etc.)
- Each theme has 3 colors: `bg`, `text`, `muted`
- Admin selects from preset swatches — no way to enter custom colors
- Theme names are stored as strings (`ThemeName`) in Supabase `page_headers` table
- `PageThemeWrapper` looks up the theme by name and applies the colors
- `brandColors.ts` has a separate fixed list of swatches used by the per-field `ColorPicker`

## New system

- Themes are still **per-page** and stored in `page_headers`
- Each page stores **3 custom hex colors** (bg, text, muted) directly — no more named themes
- Admin gets a **color wheel** + **hex input field** for each color
- Keep the 7 preset themes as **quick-start presets** (click one to populate all 3 fields, then customize from there)
- `PageThemeWrapper` reads the custom colors directly instead of looking up a named theme

---

## Database Changes

The `page_headers` table stores a JSONB `data` column containing `PageHeaderData`. We need to add 3 optional color fields to this interface. **No schema migration needed** — the JSONB column already accepts any shape.

### Update `PageHeaderData` type in `src/types/index.ts`:

```ts
export interface PageHeaderData {
  title: string;
  titleSize: number;
  subtitle?: string;
  subtitleSize?: number;
  bgImageUrl?: string;
  tabs?: PageHeaderTab[];
  hostSections?: HostSection[];
  theme?: ThemeName;           // KEEP for backward compat — used as preset reference
  // NEW: Custom color overrides (take priority over theme if set)
  customBg?: string;           // hex e.g. "#1A1F17"
  customText?: string;         // hex e.g. "#8A9A78"
  customMuted?: string;        // hex e.g. "#5a6a4a"
}
```

**Backward compatibility:** If `customBg`/`customText`/`customMuted` are all undefined, fall back to the named `theme` lookup (existing behavior). This means all current pages keep working without migration.

---

## Theme Resolution: Update `src/lib/themes.ts`

Add a helper that resolves a `PageHeaderData` into concrete colors:

```ts
export interface ResolvedTheme {
  bg: string;
  text: string;
  muted: string;
  label: string;
}

/**
 * Resolve page header data into concrete theme colors.
 * Priority: custom colors > named theme > fallback default
 */
export function resolveTheme(header: {
  theme?: ThemeName;
  customBg?: string;
  customText?: string;
  customMuted?: string;
}): ResolvedTheme {
  // If ALL three custom colors are set, use them
  if (header.customBg && header.customText && header.customMuted) {
    return {
      bg: header.customBg,
      text: header.customText,
      muted: header.customMuted,
      label: "Custom",
    };
  }

  // Otherwise fall back to named theme
  const themeName = header.theme ?? "olive";
  const theme = THEMES[themeName];
  return {
    bg: header.customBg ?? theme.bg,
    text: header.customText ?? theme.text,
    muted: header.customMuted ?? theme.muted,
    label: theme.label,
  };
}
```

---

## Update `PageThemeWrapper` — `src/components/layout/PageThemeWrapper.tsx`

The wrapper currently accepts `fixedTheme?: ThemeName`. Update it to also accept custom colors:

```tsx
interface Props {
  children: React.ReactNode;
  fixedTheme?: ThemeName;
  // NEW: custom color overrides
  customBg?: string;
  customText?: string;
  customMuted?: string;
  showIllustration?: boolean;
  bgImageUrl?: string;
}
```

In the component body, resolve the theme:

```tsx
const resolvedBg = customBg ?? theme.bg;
const resolvedText = customText ?? theme.text;

// ... use resolvedBg and resolvedText in the style props instead of theme.bg/theme.text
```

**Each page component** that uses `PageThemeWrapper` also reads `theme.text`, `theme.muted`, `theme.bg` for inline styles on its own elements. Update them to use `resolveTheme(header)` instead of `THEMES[themeName]`. The affected pages are:

- `src/app/menu/MenuPageClient.tsx`
- `src/app/coffee/CoffeePageClient.tsx`
- `src/app/events/EventsPageClient.tsx`
- `src/app/about/page.tsx`
- `src/app/club/page.tsx`
- `src/app/shop/ShopPageClient.tsx`

In each, replace the current pattern:

```tsx
// BEFORE
const themeName: ThemeName = header.theme ?? "terracotta";
const theme = THEMES[themeName];
// Uses theme.bg, theme.text, theme.muted throughout

// AFTER
import { resolveTheme } from "@/lib/themes";
const theme = resolveTheme(header);
// theme.bg, theme.text, theme.muted now reflect custom colors if set
```

And pass custom colors to `PageThemeWrapper`:

```tsx
<PageThemeWrapper
  fixedTheme={header.theme}
  customBg={header.customBg}
  customText={header.customText}
  customMuted={header.customMuted}
  bgImageUrl={header.bgImageUrl}
>
```

---

## New Admin Component: `ThemeEditor`

Create `src/components/ui/ThemeEditor.tsx` — a self-contained theme editing panel with:

1. **Preset row** — the 7 existing theme swatches as quick-start buttons
2. **Three color fields** — each with:
   - A **color wheel** (`<input type="color">`) for visual picking
   - A **hex input** field where you can type a value like `#4E3456`
   - A **preview swatch** showing the current color
3. **Live preview strip** — shows how the 3 colors look together (bg with text + muted on top)

```tsx
"use client";

import { useState } from "react";
import { THEMES, type ThemeName } from "@/lib/themes";

const PRESET_THEMES: { name: ThemeName; label: string; bg: string; text: string; muted: string }[] = [
  { name: "olive",      label: "Dark Olive",    bg: "#1A1F17", text: "#8A9A78", muted: "#5a6a4a" },
  { name: "green",      label: "Forest Green",  bg: "#3B5040", text: "#A8C4A0", muted: "#6a8a72" },
  { name: "amber",      label: "Golden Amber",  bg: "#866515", text: "#D4B870", muted: "#a08030" },
  { name: "terracotta", label: "Terracotta",     bg: "#9D5242", text: "#D4A898", muted: "#b07868" },
  { name: "plum",       label: "Deep Plum",      bg: "#4E3456", text: "#C0A0C8", muted: "#8a6892" },
  { name: "teal",       label: "Dark Teal",      bg: "#2F4A4E", text: "#90B8BC", muted: "#5a8a8e" },
  { name: "blue",       label: "Steel Blue",     bg: "#364260", text: "#90A8C8", muted: "#5a72a0" },
];

interface ThemeEditorProps {
  customBg?: string;
  customText?: string;
  customMuted?: string;
  theme?: ThemeName;
  onChange: (updates: {
    theme?: ThemeName;
    customBg?: string;
    customText?: string;
    customMuted?: string;
  }) => void;
}

export default function ThemeEditor({ customBg, customText, customMuted, theme, onChange }: ThemeEditorProps) {
  // Resolve current display colors
  const currentTheme = THEMES[theme ?? "olive"];
  const displayBg = customBg ?? currentTheme.bg;
  const displayText = customText ?? currentTheme.text;
  const displayMuted = customMuted ?? currentTheme.muted;

  function applyPreset(preset: typeof PRESET_THEMES[number]) {
    onChange({
      theme: preset.name,
      customBg: preset.bg,
      customText: preset.text,
      customMuted: preset.muted,
    });
  }

  // Validate hex — allows 3 or 6 digit hex
  function isValidHex(val: string): boolean {
    return /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(val);
  }

  // Normalize hex input — add # if missing, validate
  function handleHexInput(field: "customBg" | "customText" | "customMuted", raw: string) {
    let val = raw.trim();
    if (val && !val.startsWith("#")) val = "#" + val;
    // Only update if valid hex or empty
    if (val === "" || isValidHex(val)) {
      onChange({ [field]: val || undefined });
    }
  }

  return (
    <div className="space-y-5">
      {/* Preset quick-start row */}
      <div>
        <p className="text-[10px] tracking-widest uppercase text-gray-400 mb-2">
          Start from a preset
        </p>
        <div className="flex flex-wrap gap-3">
          {PRESET_THEMES.map((p) => {
            const isActive = displayBg === p.bg && displayText === p.text && displayMuted === p.muted;
            return (
              <button
                key={p.name}
                onClick={() => applyPreset(p)}
                title={p.label}
                className="flex flex-col items-center gap-1.5 group"
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
                  className="text-[9px] tracking-wider uppercase transition-colors"
                  style={{ color: isActive ? "#C97D5A" : "#9ca3af" }}
                >
                  {p.label}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Custom color pickers — 3 rows */}
      <div className="space-y-3">
        <p className="text-[10px] tracking-widest uppercase text-gray-400">
          Or customize each color
        </p>

        {/* Background color */}
        <ColorField
          label="Background"
          value={displayBg}
          onChange={(hex) => onChange({ customBg: hex })}
          onHexInput={(raw) => handleHexInput("customBg", raw)}
        />

        {/* Text color */}
        <ColorField
          label="Text"
          value={displayText}
          onChange={(hex) => onChange({ customText: hex })}
          onHexInput={(raw) => handleHexInput("customText", raw)}
        />

        {/* Muted / secondary color */}
        <ColorField
          label="Muted / Secondary"
          value={displayMuted}
          onChange={(hex) => onChange({ customMuted: hex })}
          onHexInput={(raw) => handleHexInput("customMuted", raw)}
        />
      </div>

      {/* Live preview strip */}
      <div>
        <p className="text-[10px] tracking-widest uppercase text-gray-400 mb-2">Preview</p>
        <div
          className="rounded-lg p-5 border border-gray-200"
          style={{ backgroundColor: displayBg }}
        >
          <p
            className="text-lg tracking-widest uppercase mb-1"
            style={{ color: displayText, fontFamily: "var(--font-display)" }}
          >
            Sample Heading
          </p>
          <p className="text-sm" style={{ color: displayText }}>
            This is how your page text will look.
          </p>
          <p className="text-xs mt-2 opacity-80" style={{ color: displayMuted }}>
            Secondary text and dividers use the muted color.
          </p>
          <div className="w-12 h-px mt-3" style={{ backgroundColor: displayMuted }} />
        </div>
      </div>
    </div>
  );
}

/* ─── Single color field: wheel + hex input ──────────────────────── */

function ColorField({
  label,
  value,
  onChange,
  onHexInput,
}: {
  label: string;
  value: string;
  onChange: (hex: string) => void;
  onHexInput: (raw: string) => void;
}) {
  const [inputVal, setInputVal] = useState(value);

  // Sync input when value changes externally (e.g. preset click)
  // Use a key or effect
  const [lastExternal, setLastExternal] = useState(value);
  if (value !== lastExternal) {
    setInputVal(value);
    setLastExternal(value);
  }

  return (
    <div className="flex items-center gap-3">
      <label className="w-28 text-[10px] tracking-widest uppercase text-gray-500 shrink-0">
        {label}
      </label>

      {/* Native color wheel input */}
      <input
        type="color"
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setInputVal(e.target.value);
        }}
        className="w-9 h-9 rounded cursor-pointer border border-gray-200 bg-transparent p-0.5"
        title={`Pick ${label.toLowerCase()} color`}
      />

      {/* Hex text input */}
      <input
        type="text"
        value={inputVal}
        onChange={(e) => setInputVal(e.target.value)}
        onBlur={() => onHexInput(inputVal)}
        onKeyDown={(e) => { if (e.key === "Enter") onHexInput(inputVal); }}
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
```

### Key UX features:
- **Color wheel** — the browser-native `<input type="color">` gives a full color picker on every platform (color wheel on Mac, grid on Windows, platform picker on mobile)
- **Hex input** — type `#4E3456` or `4E3456` (auto-adds `#`). Validates on blur/Enter.
- **Preset row** — click any preset to populate all 3 fields. Then tweak individual colors from there.
- **Live preview** — instantly shows how the 3 colors look together so you can see contrast and readability before saving

---

## Integration: Update admin page-text editor

### File: `src/app/admin/page-text/page.tsx`

Replace the current theme section (lines ~197–229, the preset swatch picker) with the new `ThemeEditor`:

```tsx
import ThemeEditor from "@/components/ui/ThemeEditor";

// In the JSX, replace the theme section:
<section className="bg-white rounded border border-gray-200 p-5 space-y-4">
  <p className={labelCls + " text-gray-700"}>Page Color Theme</p>
  <p className="text-xs text-gray-400">
    Pick a preset to start, then customize each color with the color wheel or enter a hex value.
  </p>
  <ThemeEditor
    theme={current.theme}
    customBg={current.customBg}
    customText={current.customText}
    customMuted={current.customMuted}
    onChange={(updates) => update(updates)}
  />
</section>
```

Make sure the `update()` function and state handling in this admin page can persist `customBg`, `customText`, `customMuted` alongside the existing fields. These get saved to the `page_headers` JSONB column automatically since it stores the full object.

### File: `src/app/admin/pages/page.tsx`

Same change — anywhere the theme swatch picker appears in the pages editor (around line 1311), replace with `<ThemeEditor>`.

---

## Update brandColors.ts (optional enhancement)

Once custom colors exist, the per-field `ColorPicker` (used for individual text/price color overrides on menu items) could also show the page's current custom theme colors as a "Page Theme" group at the top. This is a nice-to-have, not required for the initial build.

---

## Files Summary

| File | Action | Description |
|------|--------|-------------|
| `src/types/index.ts` | **EDIT** | Add `customBg`, `customText`, `customMuted` to `PageHeaderData` |
| `src/lib/themes.ts` | **EDIT** | Add `ResolvedTheme` interface and `resolveTheme()` helper |
| `src/components/ui/ThemeEditor.tsx` | **CREATE** | New component: preset row + color wheel/hex input for 3 colors + preview |
| `src/components/layout/PageThemeWrapper.tsx` | **EDIT** | Accept custom color props, use them over named theme |
| `src/app/admin/page-text/page.tsx` | **EDIT** | Replace swatch picker with `ThemeEditor` |
| `src/app/admin/pages/page.tsx` | **EDIT** | Replace swatch picker with `ThemeEditor` |
| `src/app/menu/MenuPageClient.tsx` | **EDIT** | Use `resolveTheme(header)` instead of `THEMES[themeName]` |
| `src/app/coffee/CoffeePageClient.tsx` | **EDIT** | Use `resolveTheme(header)` |
| `src/app/events/EventsPageClient.tsx` | **EDIT** | Use `resolveTheme(header)` |
| `src/app/about/page.tsx` | **EDIT** | Use `resolveTheme(header)` |
| `src/app/club/page.tsx` | **EDIT** | Use `resolveTheme(header)` |
| `src/app/shop/ShopPageClient.tsx` | **EDIT** | Use `resolveTheme(header)` |

---

## Implementation order

1. **Add types** — `customBg`/`customText`/`customMuted` on `PageHeaderData`
2. **Add `resolveTheme()`** helper in `themes.ts`
3. **Create `ThemeEditor` component** — test in isolation
4. **Wire into admin page-text editor** — replace the swatch section
5. **Wire into admin pages editor** — replace the swatch section there too
6. **Update `PageThemeWrapper`** — accept + apply custom colors
7. **Update all 6 page components** — use `resolveTheme(header)` pattern
8. **Test:** Pick custom colors in admin → Save → Visit customer page → Verify colors applied

## Verification

- [ ] Admin: Preset swatch row still works (click to populate all 3 fields)
- [ ] Admin: Color wheel opens and selecting a color updates the hex field
- [ ] Admin: Typing a hex value (e.g. `#FF5733`) updates the swatch and preview
- [ ] Admin: Live preview strip shows all 3 colors together accurately
- [ ] Admin: Save persists custom colors — refresh and they're still there
- [ ] Customer: Page loads with custom colors applied to background, text, and muted elements
- [ ] Backward compat: Pages that haven't been customized still use their named theme
- [ ] Mobile: Color wheel picker works on iOS and Android (native OS color picker)
