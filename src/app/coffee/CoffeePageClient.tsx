"use client";

import { useState, useRef } from "react";
import Image from "next/image";
import PageThemeWrapper from "@/components/layout/PageThemeWrapper";
import type { PageHeaderData } from "@/types";
import { THEMES } from "@/lib/themes";
import type { ThemeName } from "@/lib/themes";
import clsx from "clsx";
import type { CoffeeMenu } from "@/lib/coffeedata";

interface Props {
  menus: CoffeeMenu[];
  header: PageHeaderData;
}

export default function CoffeePageClient({ menus, header }: Props) {
  const themeName: ThemeName = header.theme ?? "olive";
  const theme = THEMES[themeName];
  const [activeId, setActiveId] = useState(menus[0]?.id ?? "");
  const [lightboxOpen, setLightboxOpen] = useState(false);

  const activeMenu = menus.find((m) => m.id === activeId);

  return (
    <PageThemeWrapper fixedTheme={themeName} showIllustration={false} bgImageUrl={header.bgImageUrl}>
      <div className="min-h-screen" style={{ color: theme.text }}>
        {/* Page title */}
        <header className="text-center pt-16 pb-6 px-6">
          {header.title && (
            <h1
              className="tracking-widest uppercase mb-2"
              style={{
                fontFamily: "var(--font-display)",
                color: theme.text,
                fontSize: `clamp(1.75rem, 7vw, ${header.titleSize}px)`,
              }}
            >
              {header.title}
            </h1>
          )}
          {header.subtitle && (
            <p
              className="leading-relaxed max-w-xl mx-auto mt-3 opacity-70"
              style={{ fontSize: `${header.subtitleSize ?? 14}px` }}
            >
              {header.subtitle}
            </p>
          )}
          <div className="w-16 h-px mx-auto mt-6" style={{ backgroundColor: theme.muted }} />
        </header>

        {/* Tabs — only show when there are multiple menus */}
        {menus.length > 1 && (
          <div
            className="flex justify-center gap-0 px-3 mb-6"
            style={{
              background: "rgba(0,0,0,0.15)",
              backdropFilter: "blur(12px)",
              WebkitBackdropFilter: "blur(12px)",
            }}
          >
            {menus.map((menu) => (
              <button
                key={menu.id}
                onClick={() => setActiveId(menu.id)}
                className={clsx(
                  "px-4 py-3 text-xs tracking-widest uppercase whitespace-nowrap transition-all duration-200 border-b-2",
                  activeId === menu.id
                    ? "border-[#C97D5A] text-[#C97D5A]"
                    : "border-transparent opacity-60 hover:opacity-90"
                )}
                style={{ color: activeId === menu.id ? "#C97D5A" : theme.text }}
              >
                {menu.label}
              </button>
            ))}
          </div>
        )}

        {/* Menu image */}
        <div className="px-4 pb-16 max-w-3xl mx-auto">
          {activeMenu?.imageUrl ? (
            <button
              onClick={() => setLightboxOpen(true)}
              className="w-full block relative group cursor-zoom-in"
              aria-label={`View ${activeMenu.label} full screen`}
            >
              <Image
                src={activeMenu.imageUrl}
                alt={activeMenu.alt || `${activeMenu.label} menu`}
                width={850}
                height={1100}
                className="w-full h-auto rounded-lg shadow-lg"
                sizes="(max-width: 768px) 100vw, 750px"
                priority
              />
              {/* Tap-to-zoom hint */}
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors rounded-lg flex items-center justify-center pointer-events-none">
                <span className="opacity-0 group-hover:opacity-100 transition-opacity text-white text-xs tracking-widest uppercase bg-black/50 px-3 py-1.5 rounded-full">
                  Tap to zoom
                </span>
              </div>
            </button>
          ) : (
            <div
              className="w-full aspect-[8.5/11] rounded-lg flex items-center justify-center"
              style={{
                backgroundColor: "rgba(255,255,255,0.05)",
                border: `1px dashed ${theme.muted}40`,
              }}
            >
              <p className="text-sm opacity-40" style={{ color: theme.text }}>
                Menu image coming soon
              </p>
            </div>
          )}
        </div>

        {/* Full-screen lightbox with native pinch-to-zoom */}
        {lightboxOpen && activeMenu?.imageUrl && (
          <Lightbox
            imageUrl={activeMenu.imageUrl}
            alt={activeMenu.alt || `${activeMenu.label} menu`}
            onClose={() => setLightboxOpen(false)}
          />
        )}
      </div>
    </PageThemeWrapper>
  );
}

/* ─── Lightbox ─────────────────────────────────────────────────────────── */

function Lightbox({
  imageUrl,
  alt,
  onClose,
}: {
  imageUrl: string;
  alt: string;
  onClose: () => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);

  return (
    <div
      className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center"
      onClick={onClose}
    >
      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 z-10 w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-colors"
        aria-label="Close"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M18 6L6 18M6 6l12 12" />
        </svg>
      </button>

      {/* Scrollable + zoomable container — native pinch-to-zoom on iOS/Android */}
      <div
        ref={containerRef}
        className="w-full h-full overflow-auto overscroll-contain"
        style={{
          touchAction: "pinch-zoom pan-x pan-y",
          WebkitOverflowScrolling: "touch",
        } as React.CSSProperties}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="min-h-full flex items-center justify-center p-4">
          {/*
            Using a regular <img> here intentionally:
            - next/image constrains dimensions which fights pinch-zoom
            - The image is already loaded from the page view (no extra request)
          */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imageUrl}
            alt={alt}
            style={{
              width: "100%",
              maxWidth: "1200px",
              height: "auto",
              touchAction: "pinch-zoom",
            }}
          />
        </div>
      </div>

      {/* Hint */}
      <p className="absolute bottom-6 left-0 right-0 text-center text-white/40 text-xs tracking-widest uppercase pointer-events-none">
        Pinch to zoom · Tap background to close
      </p>
    </div>
  );
}
