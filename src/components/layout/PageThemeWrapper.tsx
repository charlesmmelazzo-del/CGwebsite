"use client";

import { useEffect, useId, useState } from "react";
import { getRandomTheme, getTheme, type ThemeName } from "@/lib/themes";
import Image from "next/image";

interface Props {
  children: React.ReactNode;
  /** Force a specific theme — used for pages that have a fixed theme */
  fixedTheme?: ThemeName;
  /** Show the subtle botanical illustration background */
  showIllustration?: boolean;
  /** Custom background image URL — overrides the theme background color */
  bgImageUrl?: string;
}

export default function PageThemeWrapper({
  children,
  fixedTheme,
  showIllustration = true,
  bgImageUrl,
}: Props) {
  const [themeName, setThemeName] = useState<ThemeName>(fixedTheme ?? "green");
  const [mounted, setMounted] = useState(false);
  const rawId = useId();
  // Sanitize for use as a CSS id (remove colons, prefix with letter)
  const bgId = `pw${rawId.replace(/[^a-zA-Z0-9_-]/g, "")}`;

  useEffect(() => {
    if (!fixedTheme) {
      setThemeName(getRandomTheme());
    }
    setMounted(true);
  }, [fixedTheme]);

  const theme = getTheme(themeName);

  if (!mounted) {
    return (
      <div
        style={{ backgroundColor: theme.bg, color: theme.text }}
        className="min-h-screen transition-colors duration-500"
      >
        {children}
      </div>
    );
  }

  return (
    <>
      {/* Background image — desktop only (≥768px) via media query */}
      {bgImageUrl && (
        <style>{`
          @media (min-width: 768px) {
            #${bgId} {
              background-image: url(${bgImageUrl});
              background-size: cover;
              background-position: center;
              background-attachment: fixed;
            }
          }
        `}</style>
      )}
      <div
        id={bgId}
        style={{ backgroundColor: theme.bg, color: theme.text }}
        className="min-h-screen transition-colors duration-500 relative overflow-hidden animate-fade-in"
      >
        {/* Dark overlay — desktop only, matches the bg image */}
        {bgImageUrl && (
          <div className="hidden md:block absolute inset-0 bg-black/50 pointer-events-none" />
        )}
        {/* Botanical illustration background */}
        {!bgImageUrl && showIllustration && theme.illustration && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none opacity-30">
            <div className="relative w-64 h-64 md:w-96 md:h-96">
              <Image
                src={theme.illustration}
                alt=""
                fill
                className="object-contain"
                aria-hidden
              />
            </div>
          </div>
        )}
        <div className="relative z-10">{children}</div>
      </div>
    </>
  );
}
