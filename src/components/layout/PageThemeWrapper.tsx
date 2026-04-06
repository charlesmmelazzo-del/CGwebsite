"use client";

import { useEffect, useState } from "react";
import { getRandomTheme, getTheme, type ThemeName } from "@/lib/themes";
import Image from "next/image";

interface Props {
  children: React.ReactNode;
  /** Force a specific theme — used for pages that have a fixed theme */
  fixedTheme?: ThemeName;
  /** Show the subtle botanical illustration background */
  showIllustration?: boolean;
}

export default function PageThemeWrapper({
  children,
  fixedTheme,
  showIllustration = true,
}: Props) {
  const [themeName, setThemeName] = useState<ThemeName>(fixedTheme ?? "green");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    if (!fixedTheme) {
      setThemeName(getRandomTheme());
    }
    setMounted(true);
  }, [fixedTheme]);

  const theme = getTheme(themeName);

  if (!mounted) {
    // Prevent flash — render with default until client mounts
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
    <div
      style={{ backgroundColor: theme.bg, color: theme.text }}
      className="min-h-screen transition-colors duration-500 relative overflow-hidden animate-fade-in"
    >
      {/* Botanical illustration background */}
      {showIllustration && theme.illustration && (
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
  );
}
