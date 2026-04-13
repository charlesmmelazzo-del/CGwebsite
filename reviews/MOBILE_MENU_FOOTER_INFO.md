# Mobile Menu — Show Hours, Address & Contact in Navigation Drawer

**For:** Claude Code
**Scope:** When users open the mobile hamburger menu, display the business hours, address, and contact info at the bottom of the nav drawer — so they can find this info easily without scrolling to the page footer.

---

## Current state

**`src/components/layout/Header.tsx`:**
- Mobile drawer opens when hamburger is tapped (lines 158–186).
- Drawer contains only nav links (About, Club, Shop, Events, Menu, Coffee).
- Drawer has `maxHeight: calc(100dvh - 60px)` and `overflow-y-auto`.
- Component receives only `HeaderConfig` as a prop — it does NOT have access to `SiteSettings` (hours, phone, email, address).

**`src/app/layout.tsx`:**
- Fetches `SiteSettings` via `getSiteSettings()` (line 44).
- Passes `settings` to `Footer` (line 67) but NOT to `Header` (line 57).

**`src/lib/constants.ts` — `SITE_SETTINGS`:**
- Hardcoded fallback with phone, email, address, hours, social links.

**`src/types/index.ts` — `SiteSettings`:**
```ts
interface SiteSettings {
  phone: string;
  email: string;
  address: string;
  addressLine2: string;
  hours: BusinessHours[];
  socialLinks?: { label: string; url: string }[];
}
```

---

## Changes needed

### 1. Pass `SiteSettings` to Header — `src/app/layout.tsx`

The Header needs access to hours/contact data. Add a `settings` prop:

```tsx
// BEFORE (line 57)
<Header config={header} />

// AFTER
<Header config={header} settings={settings} />
```

### 2. Update Header to accept and display SiteSettings — `src/components/layout/Header.tsx`

**Update the component signature:**

```tsx
// BEFORE
export default function Header({ config }: { config: HeaderConfig }) {

// AFTER
import type { HeaderConfig, SiteSettings } from "@/types";
import { SITE_SETTINGS } from "@/lib/constants";
import { Phone, Mail, MapPin, Clock } from "lucide-react";

export default function Header({ config, settings }: { config: HeaderConfig; settings?: SiteSettings }) {
  const s = settings ?? SITE_SETTINGS;
```

Note: `SiteSettings` is already imported via the types file. Add `SITE_SETTINGS` as a fallback (same pattern the Footer uses). Add `Phone`, `Mail`, `MapPin`, `Clock` from lucide-react (Footer already uses `Phone`, `Mail`, `MapPin`).

**Add a footer info section inside the mobile drawer**, below the nav links (after line 185, before the closing `</nav>`):

```tsx
{/* ── Mobile drawer ── */}
{mobileOpen && (
  <nav
    className="md:hidden px-5 pb-5 animate-fade-in overflow-y-auto"
    style={{
      background: config.bgColor,
      borderTop: `1px solid ${config.borderColor}`,
      maxHeight: "calc(100dvh - 60px)",
    }}
  >
    {/* Nav links — unchanged */}
    {visibleLinks.map((link) => (
      <Link
        key={link.id}
        href={link.href}
        onClick={() => setMobileOpen(false)}
        target={link.openInNewTab ? "_blank" : undefined}
        className="block py-3.5 transition-colors"
        style={{
          fontSize:      fontSize + "px",
          letterSpacing: spacing,
          fontFamily:    "var(--font-nav)",
          textTransform: "uppercase",
          color:         pathname === link.href ? config.activeColor : config.textColor,
          borderBottom:  `1px solid ${config.borderColor}`,
        }}
      >
        {link.label}
      </Link>
    ))}

    {/* ── Business info — NEW ── */}
    <div
      className="mt-5 pt-4 space-y-4"
      style={{
        borderTop: `1px solid ${config.borderColor}`,
        color: config.textColor,
        opacity: 0.6,
      }}
    >
      {/* Hours */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <Clock size={12} style={{ color: config.activeColor }} />
          <span
            className="text-[10px] tracking-widest uppercase"
            style={{ color: config.activeColor }}
          >
            Hours
          </span>
        </div>
        {s.hours.map((h) => (
          <div key={h.label} className="mb-2">
            <p className="text-[10px] tracking-wider uppercase opacity-80">
              {h.label}
            </p>
            {h.lines.map((line, i) => (
              <p key={i} className="text-xs leading-relaxed">
                {line}
              </p>
            ))}
          </div>
        ))}
      </div>

      {/* Address */}
      <div className="flex items-start gap-2">
        <MapPin size={12} className="mt-0.5 shrink-0" style={{ color: config.activeColor }} />
        <div className="text-xs leading-relaxed">
          <p>{s.address}</p>
          <p>{s.addressLine2}</p>
        </div>
      </div>

      {/* Phone */}
      <a
        href={`tel:${s.phone}`}
        className="flex items-center gap-2 text-xs hover:opacity-80 transition-opacity"
        style={{ color: config.textColor }}
      >
        <Phone size={12} style={{ color: config.activeColor }} />
        <span>{s.phone}</span>
      </a>

      {/* Email */}
      <a
        href={`mailto:${s.email}`}
        className="flex items-center gap-2 text-xs hover:opacity-80 transition-opacity"
        style={{ color: config.textColor }}
      >
        <Mail size={12} style={{ color: config.activeColor }} />
        <span>{s.email}</span>
      </a>

      {/* Social links */}
      {s.socialLinks?.map((link) => (
        <a
          key={link.label}
          href={link.url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 text-xs hover:opacity-80 transition-opacity"
          style={{ color: config.textColor }}
        >
          <span className="text-xs" style={{ color: config.activeColor }}>↗</span>
          <span>{link.label}</span>
        </a>
      ))}
    </div>
  </nav>
)}
```

### Design notes

- **Visual separation:** A `borderTop` divider separates the nav links from the business info, with `mt-5 pt-4` spacing.
- **Subtle presence:** The entire info block is set to `opacity: 0.6` so it doesn't compete with the nav links for attention. The nav links are the primary content; the business info is secondary/contextual.
- **Accent color:** Icons and section labels use `config.activeColor` (#C97D5A terracotta) for a subtle pop against the muted text.
- **Tappable:** Phone and email are wrapped in `<a>` tags with `tel:` and `mailto:` protocols, so users can tap to call/email directly.
- **Scrollable:** The drawer already has `overflow-y-auto` with `maxHeight: calc(100dvh - 60px)`, so if the nav links + info block exceed the viewport, users can scroll within the drawer.
- **Same data source as Footer:** Uses `SiteSettings` with `SITE_SETTINGS` as fallback — identical pattern to the Footer component, so hours/contact data is always in sync.

---

## Files to modify

| File | Change |
|------|--------|
| `src/app/layout.tsx` | Pass `settings` prop to `<Header>` |
| `src/components/layout/Header.tsx` | Accept `settings` prop, add business info section to mobile drawer |

---

## Acceptance criteria

1. Opening the mobile hamburger menu shows nav links at top, then a divider, then hours, address, phone, email, and social links below.
2. Hours display both Coffee and Cocktails schedules with their time ranges.
3. Phone number is tappable (opens phone dialer).
4. Email is tappable (opens email client).
5. Instagram link opens in a new tab.
6. Address displays on two lines (street + city/state/zip).
7. Business info uses the same `SiteSettings` data as the Footer — if settings are updated in Supabase, both the footer and mobile menu reflect the change.
8. Desktop nav is completely unchanged — this only affects the mobile drawer.
9. The drawer scrolls if content exceeds viewport height.
