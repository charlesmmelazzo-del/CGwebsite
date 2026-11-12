"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Menu, X, Clock, MapPin, Phone, Mail, ChevronDown } from "lucide-react";
import { usePathname } from "next/navigation";
import type { HeaderConfig, NavLink, SiteSettings } from "@/types";
import { SITE_SETTINGS } from "@/lib/constants";

function LogoImage({ size, textColor, logoUrl }: { size: number; textColor: string; logoUrl?: string }) {
  const [failed, setFailed] = useState(false);
  const src = logoUrl || "/images/logo/logo.svg";

  if (failed) {
    return (
      <div
        className="flex flex-col items-center justify-center leading-none select-none"
        style={{ width: size, height: size }}
      >
        <span style={{ color: textColor, fontFamily: "var(--font-display)", fontSize: size * 0.14 }}>
          Common Good
        </span>
        <span style={{ color: textColor, fontFamily: "var(--font-nav)", fontSize: size * 0.09, opacity: 0.6, marginTop: 2 }}>
          Cocktail House
        </span>
      </div>
    );
  }

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <Image
        src={src}
        alt="Common Good Cocktail House"
        fill
        unoptimized
        className="object-contain"
        priority
        onError={() => setFailed(true)}
      />
    </div>
  );
}

// ── Desktop nav fitting ───────────────────────────────────────────────────────
// The header's font size, letter spacing and link padding come from the admin's
// Header & Nav settings, and the number of links changes over time. So the
// desktop nav treats those settings as the *largest* it may be and fits itself
// to the window:
//   1. the logo is always dead centre (the two sides are equal-width columns);
//   2. if the links don't fit, the whole nav scales down together (padding and
//      letter spacing are in em, so one font-size drives all three);
//   3. if it would have to shrink below a readable size, the last links move
//      into a "More" menu instead.
// Layout effects only run in the browser; this keeps server rendering quiet.
const useIsoLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

const MIN_NAV_FONT = 11;   // px — never shrink the nav text below this
const SIDE_MARGIN  = 16;   // px kept clear at each outer edge
const LOGO_PAD_X   = 32;   // px each side of the logo (matches px-8)
const MORE_ID      = "__more";

/** Letter spacing as an em number, whatever unit the admin typed. */
function spacingEm(spacing: string, fontSize: number): number {
  const n = parseFloat(spacing);
  if (!Number.isFinite(n)) return 0.22;
  if (spacing.trim().endsWith("px")) return n / fontSize;
  return n; // em (or unitless) — already relative
}

/** Split links around the logo: the left side takes the extra one when odd. */
function splitNav(links: NavLink[]): [NavLink[], NavLink[]] {
  const half = Math.ceil(links.length / 2);
  return [links.slice(0, half), links.slice(half)];
}

interface NavFit {
  font: number | null;   // px; null until measured in the browser
  count: number;         // how many links are shown inline (the rest go under More)
}

export default function Header({ config, settings }: { config: HeaderConfig; settings?: SiteSettings }) {
  const s = settings ?? SITE_SETTINGS;
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();

  // Sort and filter nav links from config (guard against undefined)
  const visibleLinks = [...(config.navLinks ?? [])]
    .filter((l) => l.visible)
    .sort((a, b) => a.order - b.order);

  // Pull sizing from config with sensible fallbacks
  const headerH   = config.headerHeight       ?? 72;
  const mobileH   = config.mobileHeaderHeight ?? 52;
  const logoSize  = config.logoSize           ?? 58;
  const mLogoSize = config.mobileLogoSize     ?? 44;
  const fontSize  = config.navFontSize        ?? 13;
  const spacing   = config.navLetterSpacing   ?? "0.22em";
  const padX      = config.navPaddingX        ?? 20;

  const spaceEm   = spacingEm(spacing, fontSize);
  const padEm     = padX / fontSize;
  const logoBlock = logoSize + LOGO_PAD_X * 2;

  // ── Fit the desktop nav to the window ──────────────────────────────────────
  const rowRef     = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const [fit, setFit] = useState<NavFit>({ font: null, count: visibleLinks.length });
  const linkKey = visibleLinks.map((l) => `${l.id}:${l.label}`).join("|");

  useIsoLayoutEffect(() => {
    const row = rowRef.current;
    const measure = measureRef.current;
    if (!row || !measure) return;

    const compute = () => {
      const rowW = row.clientWidth;
      if (!rowW) return; // desktop row is hidden (mobile layout)
      // Natural widths at the configured (largest) size.
      const widths: Record<string, number> = {};
      measure.querySelectorAll<HTMLElement>("[data-nav-id]").forEach((el) => {
        widths[el.dataset.navId as string] = el.getBoundingClientRect().width;
      });
      const moreW = widths[MORE_ID] ?? 0;
      const side  = (rowW - logoBlock) / 2 - SIDE_MARGIN;
      const sum   = (ls: NavLink[]) => ls.reduce((t, l) => t + (widths[l.id] ?? 0), 0);

      const n = visibleLinks.length;
      let best: NavFit = { font: MIN_NAV_FONT, count: Math.min(n, 2) };
      for (let k = n; k >= 1; k--) {
        const [l, r] = splitNav(visibleLinks.slice(0, k));
        const widest = Math.max(sum(l), sum(r) + (k < n ? moreW : 0));
        const scale  = widest > 0 ? Math.min(1, side / widest) : 1;
        const font   = Math.floor(fontSize * scale * 100) / 100;
        if (font >= Math.min(MIN_NAV_FONT, fontSize) || k === 1) {
          best = { font: Math.max(font, Math.min(MIN_NAV_FONT, fontSize)), count: k };
          break;
        }
      }
      setFit((prev) => (prev.font === best.font && prev.count === best.count ? prev : best));
    };

    compute();
    const ro = new ResizeObserver(compute);
    ro.observe(row);
    // Web fonts change the text widths once they load.
    let cancelled = false;
    document.fonts?.ready.then(() => { if (!cancelled) compute(); });
    return () => { cancelled = true; ro.disconnect(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [linkKey, fontSize, spaceEm, padEm, logoBlock]);

  const inlineLinks   = visibleLinks.slice(0, fit.count);
  const overflowLinks = visibleLinks.slice(fit.count);
  const [leftNav, rightNav] = splitNav(inlineLinks);

  // Before the browser has measured (server render, first paint) estimate the
  // width from the character count so the nav already scales with the window.
  const estSide = (ls: NavLink[]) =>
    ls.reduce((t, l) => t + l.label.length * fontSize * (0.72 + spaceEm) + padX * 2, 0);
  const [estL, estR] = splitNav(visibleLinks);
  const estWidest = Math.max(estSide(estL), estSide(estR), 1);
  const navFont = fit.font != null
    ? `${fit.font}px`
    : `clamp(${Math.min(MIN_NAV_FONT, fontSize)}px, calc((100vw - ${logoBlock + SIDE_MARGIN * 2}px) * ${(fontSize / (2 * estWidest)).toFixed(5)}), ${fontSize}px)`;

  // ── "More" menu (only when links overflow) ─────────────────────────────────
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);
  useEffect(() => { setMoreOpen(false); }, [pathname]);
  useEffect(() => {
    if (!moreOpen) return;
    const onDown = (e: MouseEvent) => {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) setMoreOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setMoreOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [moreOpen]);
  const overflowActive = overflowLinks.some((l) => l.href === pathname);

  // Padding and letter spacing are in em so they scale with the nav font size.
  function linkStyle(href: string) {
    const active = pathname === href;
    return {
      padding:          `0 ${padEm}em`,
      letterSpacing:    `${spaceEm}em`,
      fontFamily:       "var(--font-nav)",
      textTransform:    "uppercase" as const,
      color:            active ? config.activeColor : config.textColor,
      borderBottomColor: active ? config.activeColor : "transparent",
      whiteSpace:       "nowrap" as const,
    };
  }

  return (
    <header
      className="fixed top-0 left-0 right-0 z-50"
      style={{ background: config.bgColor }}
    >
      {/* ── Desktop ─────────────────────────────────────────────────────────── */}
      <div
        ref={rowRef}
        className="hidden md:grid items-stretch relative"
        style={{
          height: headerH,
          borderBottom: `1px solid ${config.borderColor}`,
          gridTemplateColumns: "minmax(0, 1fr) auto minmax(0, 1fr)",
          fontSize: navFont,
        }}
      >
        {/* Hidden copy at the configured size, used only to measure link widths */}
        <div
          ref={measureRef}
          aria-hidden="true"
          className="absolute left-0 top-0 flex h-0 overflow-hidden invisible pointer-events-none"
          style={{ fontSize: fontSize + "px" }}
        >
          {visibleLinks.map((link) => (
            <span key={link.id} data-nav-id={link.id} className="shrink-0" style={linkStyle("")}>
              {link.label}
            </span>
          ))}
          <span data-nav-id={MORE_ID} className="shrink-0 inline-flex items-center gap-[0.35em]" style={linkStyle("")}>
            More <ChevronDown size={14} />
          </span>
        </div>

        {/* Left nav */}
        <nav className="flex items-stretch justify-end min-w-0" aria-label="Main">
          {leftNav.map((link) => (
            <Link
              key={link.id}
              href={link.href}
              target={link.openInNewTab ? "_blank" : undefined}
              rel={link.openInNewTab ? "noopener noreferrer" : undefined}
              className="flex items-center border-b-2 transition-colors duration-200"
              style={linkStyle(link.href)}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        {/* Logo — always centred: the two nav columns are equal width */}
        <Link
          href="/"
          className="flex items-center px-8 shrink-0 transition-opacity duration-200 hover:opacity-80"
        >
          <LogoImage size={logoSize} textColor={config.textColor} logoUrl={config.logoUrl} />
        </Link>

        {/* Right nav */}
        <nav className="flex items-stretch justify-start min-w-0" aria-label="Main, continued">
          {rightNav.map((link) => (
            <Link
              key={link.id}
              href={link.href}
              target={link.openInNewTab ? "_blank" : undefined}
              rel={link.openInNewTab ? "noopener noreferrer" : undefined}
              className="flex items-center border-b-2 transition-colors duration-200"
              style={linkStyle(link.href)}
            >
              {link.label}
            </Link>
          ))}

          {overflowLinks.length > 0 && (
            <div
              ref={moreRef}
              className="relative flex items-stretch"
              onMouseEnter={() => setMoreOpen(true)}
              onMouseLeave={() => setMoreOpen(false)}
            >
              <button
                type="button"
                aria-haspopup="true"
                aria-expanded={moreOpen}
                onClick={() => setMoreOpen((o) => !o)}
                className="flex items-center gap-[0.35em] border-b-2 transition-colors duration-200"
                style={{
                  ...linkStyle(""),
                  color: overflowActive ? config.activeColor : config.textColor,
                  borderBottomColor: overflowActive ? config.activeColor : "transparent",
                }}
              >
                More
                <ChevronDown size={14} className={`transition-transform duration-200 ${moreOpen ? "rotate-180" : ""}`} />
              </button>
              {moreOpen && (
                <div
                  className="absolute right-0 top-full min-w-full py-2 shadow-lg"
                  style={{
                    background: config.bgColor,
                    border: `1px solid ${config.borderColor}`,
                    borderTop: "none",
                  }}
                >
                  {overflowLinks.map((link) => (
                    <Link
                      key={link.id}
                      href={link.href}
                      target={link.openInNewTab ? "_blank" : undefined}
                      rel={link.openInNewTab ? "noopener noreferrer" : undefined}
                      onClick={() => setMoreOpen(false)}
                      className="block transition-colors duration-200 hover:opacity-80"
                      style={{
                        ...linkStyle(link.href),
                        padding: `0.9em ${padEm}em`,
                        borderBottomColor: undefined,
                      }}
                    >
                      {link.label}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          )}
        </nav>
      </div>

      {/* ── Mobile header ────────────────────────────────────────────────────── */}
      <div
        className="flex md:hidden items-center justify-between px-4"
        style={{ height: mobileH, borderBottom: `1px solid ${config.borderColor}` }}
      >
        <Link href="/" className="flex items-center gap-2.5">
          <LogoImage size={mLogoSize} textColor={config.textColor} logoUrl={config.logoUrl} />
          <div className="leading-tight">
            <p style={{ color: config.textColor, fontFamily: "var(--font-display)", fontSize: 13, letterSpacing: "0.2em", textTransform: "uppercase" }}>
              Common Good
            </p>
            <p style={{ color: config.borderColor, fontFamily: "var(--font-nav)", fontSize: 9, letterSpacing: "0.22em", textTransform: "uppercase" }}>
              Cocktail House
            </p>
          </div>
        </Link>
        <button
          onClick={() => setMobileOpen((o) => !o)}
          style={{ color: config.textColor }}
          className="p-3"
          aria-label="Toggle menu"
        >
          {mobileOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {/* ── Mobile drawer ────────────────────────────────────────────────────── */}
      {mobileOpen && (
        <nav
          className="md:hidden px-5 pb-5 animate-fade-in overflow-y-auto"
          style={{
            background: config.bgColor,
            borderTop: `1px solid ${config.borderColor}`,
            maxHeight: "calc(100dvh - 60px)",
          }}
        >
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

          {/* ── Business info ─────────────────────────────────────────────── */}
          <div
            className="mt-5 pt-4 space-y-4"
            style={{ borderTop: `1px solid ${config.borderColor}`, color: config.textColor, opacity: 0.6 }}
          >
            {/* Hours */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Clock size={12} style={{ color: config.activeColor }} />
                <span className="text-[10px] tracking-widest uppercase" style={{ color: config.activeColor }}>
                  Hours
                </span>
              </div>
              {s.hours.map((h) => (
                <div key={h.label} className="mb-2">
                  <p className="text-[10px] tracking-wider uppercase opacity-80">{h.label}</p>
                  {h.lines.map((line, i) => (
                    <p key={i} className="text-xs leading-relaxed">{line}</p>
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
    </header>
  );
}
