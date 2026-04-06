"use client";

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import { Menu, X } from "lucide-react";
import { NAV_LINKS } from "@/lib/constants";
import { usePathname } from "next/navigation";
import clsx from "clsx";

// Split nav links evenly around the logo
const LEFT_NAV  = NAV_LINKS.slice(0, 3);   // ABOUT, CLUB, SHOP
const RIGHT_NAV = NAV_LINKS.slice(3);      // EVENTS, MENU, COFFEE

function LogoImage({ size }: { size: number }) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div
        className="flex flex-col items-center justify-center leading-none select-none"
        style={{ width: size, height: size }}
      >
        <span
          className="text-[#8A9A78] tracking-[0.15em] uppercase"
          style={{ fontFamily: "var(--font-display)", fontSize: size * 0.14, fontWeight: 400 }}
        >
          Common Good
        </span>
        <span
          className="text-[#5a6a4a] tracking-[0.2em] uppercase mt-0.5"
          style={{ fontFamily: "var(--font-nav)", fontSize: size * 0.09, fontWeight: 300 }}
        >
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

export default function Header() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-[#1A1F17]">

      {/* ── Desktop nav: full-height click targets ──────────────────────────── */}
      <div className="hidden md:flex items-stretch h-[78px] border-b border-[#2a3020]">

        {/* Left nav — right-aligned, fills height */}
        <nav className="flex items-stretch flex-1 justify-end">
          {LEFT_NAV.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={clsx(
                "flex items-center px-6 text-[13px] tracking-[0.22em] uppercase transition-colors duration-200 whitespace-nowrap border-b-2",
                pathname === link.href
                  ? "text-[#C97D5A] border-[#C97D5A]"
                  : "text-[#8A9A78] border-transparent hover:text-[#C97D5A] hover:bg-white/5"
              )}
              style={{ fontFamily: "var(--font-nav)" }}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        {/* Logo — centered */}
        <Link
          href="/"
          className="flex items-center px-8 shrink-0 transition-opacity duration-200 hover:opacity-80"
        >
          <LogoImage size={58} />
        </Link>

        {/* Right nav — left-aligned, fills height */}
        <nav className="flex items-stretch flex-1 justify-start">
          {RIGHT_NAV.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={clsx(
                "flex items-center px-6 text-[13px] tracking-[0.22em] uppercase transition-colors duration-200 whitespace-nowrap border-b-2",
                pathname === link.href
                  ? "text-[#C97D5A] border-[#C97D5A]"
                  : "text-[#8A9A78] border-transparent hover:text-[#C97D5A] hover:bg-white/5"
              )}
              style={{ fontFamily: "var(--font-nav)" }}
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </div>

      {/* ── Mobile header ── */}
      <div className="flex md:hidden items-center justify-between px-4 py-2.5 border-b border-[#2a3020]">
        {/* Logo + wordmark */}
        <Link href="/" className="flex items-center gap-2.5">
          <LogoImage size={38} />
          <div className="leading-tight">
            <p
              className="text-[#8A9A78] tracking-[0.2em] uppercase"
              style={{ fontFamily: "var(--font-display)", fontSize: 13 }}
            >
              Common Good
            </p>
            <p
              className="text-[9px] tracking-[0.22em] uppercase text-[#5a6a4a]"
              style={{ fontFamily: "var(--font-nav)" }}
            >
              Cocktail House
            </p>
          </div>
        </Link>

        {/* Hamburger */}
        <button
          onClick={() => setMobileOpen((o) => !o)}
          className="text-[#8A9A78] p-1"
          aria-label="Toggle menu"
        >
          {mobileOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <nav className="md:hidden bg-[#1A1F17] border-t border-[#2a3020] px-5 pb-5 animate-fade-in">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setMobileOpen(false)}
              className={clsx(
                "block py-3.5 text-[13px] tracking-[0.22em] uppercase border-b border-[#1e2a1a] transition-colors",
                pathname === link.href
                  ? "text-[#C97D5A]"
                  : "text-[#8A9A78] hover:text-[#C97D5A]"
              )}
              style={{ fontFamily: "var(--font-nav)" }}
            >
              {link.label}
            </Link>
          ))}
        </nav>
      )}
    </header>
  );
}
