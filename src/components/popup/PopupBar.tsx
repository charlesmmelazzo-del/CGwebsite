"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Menu, X } from "lucide-react";
import type { PopupViewer } from "@/lib/popup/types";

/**
 * The Pop Up Zone's own slim chrome.
 *
 * The zone deliberately does NOT use the main site header — a pop-up that's a
 * video game or a trivia board needs the whole viewport and its own visual
 * language. This bar is the minimum needed to get back out.
 */
export default function PopupBar({
  viewer,
  accent = "#C97D5A",
}: {
  viewer: PopupViewer | null;
  accent?: string;
}) {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  async function signOut() {
    await fetch("/api/popup/session", { method: "DELETE" });
    router.push("/popup");
    router.refresh();
  }

  const links = [
    { href: "/popup", label: "Current Pop Up" },
    { href: "/popup/archive", label: "Past Pop Ups" },
  ];

  return (
    <header className="sticky top-0 z-40 backdrop-blur-md bg-black/40 border-b border-white/10">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-12 flex items-center justify-between gap-4">
        <Link
          href="/popup"
          className="text-[10px] sm:text-[11px] tracking-[0.25em] uppercase text-white/90 hover:text-white transition-colors whitespace-nowrap"
        >
          Pop Up Zone
        </Link>

        {/* Desktop links */}
        <nav className="hidden sm:flex items-center gap-6">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="text-[10px] tracking-[0.2em] uppercase text-white/60 hover:text-white transition-colors"
            >
              {l.label}
            </Link>
          ))}
          {viewer ? (
            <>
              <Link
                href="/popup/account"
                style={{ color: accent }}
                className="text-[10px] tracking-[0.2em] uppercase hover:opacity-80 transition-opacity"
              >
                {viewer.profile?.firstName || "Account"}
              </Link>
              <button
                onClick={signOut}
                className="text-[10px] tracking-[0.2em] uppercase text-white/40 hover:text-white/80 transition-colors"
              >
                Sign Out
              </button>
            </>
          ) : (
            <Link
              href="/popup/login"
              style={{ color: accent }}
              className="text-[10px] tracking-[0.2em] uppercase hover:opacity-80 transition-opacity"
            >
              Sign In
            </Link>
          )}
          <Link
            href="/"
            className="text-[10px] tracking-[0.2em] uppercase text-white/40 hover:text-white/80 transition-colors"
          >
            ← Site
          </Link>
        </nav>

        {/* Mobile toggle */}
        <button
          onClick={() => setOpen((o) => !o)}
          className="sm:hidden text-white/70 hover:text-white"
          aria-label={open ? "Close menu" : "Open menu"}
        >
          {open ? <X size={18} /> : <Menu size={18} />}
        </button>
      </div>

      {open && (
        <nav className="sm:hidden border-t border-white/10 bg-black/70 px-4 py-3 flex flex-col gap-3">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              onClick={() => setOpen(false)}
              className="text-[11px] tracking-[0.2em] uppercase text-white/70"
            >
              {l.label}
            </Link>
          ))}
          {viewer ? (
            <>
              <Link
                href="/popup/account"
                onClick={() => setOpen(false)}
                style={{ color: accent }}
                className="text-[11px] tracking-[0.2em] uppercase"
              >
                My Account
              </Link>
              <button
                onClick={signOut}
                className="text-left text-[11px] tracking-[0.2em] uppercase text-white/40"
              >
                Sign Out
              </button>
            </>
          ) : (
            <Link
              href="/popup/login"
              onClick={() => setOpen(false)}
              style={{ color: accent }}
              className="text-[11px] tracking-[0.2em] uppercase"
            >
              Sign In
            </Link>
          )}
          <Link
            href="/"
            onClick={() => setOpen(false)}
            className="text-[11px] tracking-[0.2em] uppercase text-white/40"
          >
            ← Back to site
          </Link>
        </nav>
      )}
    </header>
  );
}
