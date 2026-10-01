"use client";

// A phone-sized frame that runs the real guest app inside it. Used by the
// partner showcase and the pre-publish preview.

import { useEffect, useState, type ReactNode } from "react";

// ─── Phone frame ─────────────────────────────────────────────────────────────

export const PHONE_W = 390;
const PHONE_H = 800;

export function usePhoneScale() {
  const [scale, setScale] = useState(0.8);
  useEffect(() => {
    const fit = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      const s = w < 1024 ? Math.min((w - 48) / PHONE_W, (h * 0.7) / PHONE_H) : Math.min(1, (h - 150) / PHONE_H);
      setScale(Math.max(0.5, Math.min(1, s)));
    };
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, []);
  return scale;
}

export function PhoneFrame({ children, scale }: { children: ReactNode; scale: number }) {
  return (
    <div style={{ width: PHONE_W * scale, height: PHONE_H * scale }} className="shrink-0 mx-auto">
      {/* The transform also makes the guest app's fixed header and tab bar
          sit inside the phone instead of the browser window. */}
      <div
        style={{ width: PHONE_W, height: PHONE_H, transform: `scale(${scale})`, transformOrigin: "top left" }}
        className="relative rounded-[48px] border-[10px] border-[#2a2925] bg-[#12110e] shadow-[0_30px_80px_rgba(0,0,0,0.55)] overflow-hidden"
      >
        <div data-phone-scroller className="absolute inset-0 overflow-y-auto overflow-x-hidden cmp-scroll-x">
          {children}
        </div>
      </div>
    </div>
  );
}

