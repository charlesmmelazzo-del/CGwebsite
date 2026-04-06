"use client";

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import { Menu, X } from "lucide-react";
import { usePathname } from "next/navigation";
import type { HeaderConfig } from "@/types";

function LogoImage({ size, textColor }: { size: number; textColor: string }) {
  const [failed, setFailed] = useState(false);

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
        src="/images/logo/logo.png"
        alt="Common Good Cocktail House"
        fill
        className="object-contain"
        priority
        onError={() => setFailed(true)}
      />
    </div>
  );
}

export default function Header({ config }: { config: HeaderConfig }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();

  // Sort and filter nav links from config
  const visibleLinks = [...config.navLinks]
    .filter((l) => l.visible)
    .sort((a, b) => a.order - b.order);
  const half     = Math.ceil(visibleLinks.length / 2);
  const leftNav  = visibleLinks.slice(0, half);
  const rightNav = visibleLinks.slice(half);

  // Pull sizing from config with sensible fallbacks
  const headerH   = config.headerHeight       ?? 72;
  const mobileH   = config.mobileHeaderHeight ?? 52;
  const logoSize  = config.logoSize           ?? 58;
  const mLogoSize = config.mobileLogoSize     ?? 44;
  const fontSize  = config.navFontSize        ?? 13;
  const spacing   = config.navLetterSpacing   ?? "0.22em";
  const padX      = config.navPaddingX        ?? 20;

  function linkStyle(href: string) {
    const active = pathname === href;
    return {
      padding:          `0 ${padX}px`,
      fontSize:         fontSize + "px",
      letterSpacing:    spacing,
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
        className="hidden md:flex items-stretch"
        style={{ height: headerH, borderBottom: `1px solid ${config.borderColor}` }}
      >
        {/* Left nav */}
        <nav className="flex items-stretch flex-1 justify-end">
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

        {/* Logo */}
        <Link
          href="/"
          className="flex items-center px-8 shrink-0 transition-opacity duration-200 hover:opacity-80"
        >
          <LogoImage size={logoSize} textColor={config.textColor} />
        </Link>

        {/* Right nav */}
        <nav className="flex items-stretch flex-1 justify-start">
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
        </nav>
      </div>

      {/* ── Mobile header ────────────────────────────────────────────────────── */}
      <div
        className="flex md:hidden items-center justify-between px-4"
        style={{ height: mobileH, borderBottom: `1px solid ${config.borderColor}` }}
      >
        <Link href="/" className="flex items-center gap-2.5">
          <LogoImage size={mLogoSize} textColor={config.textColor} />
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
          className="p-1"
          aria-label="Toggle menu"
        >
          {mobileOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {/* ── Mobile drawer ────────────────────────────────────────────────────── */}
      {mobileOpen && (
        <nav
          className="md:hidden px-5 pb-5 animate-fade-in"
          style={{ background: config.bgColor, borderTop: `1px solid ${config.borderColor}` }}
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
        </nav>
      )}
    </header>
  );
}
