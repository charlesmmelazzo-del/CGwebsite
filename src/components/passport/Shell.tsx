"use client";

import Link from "next/link";
import { useEffect, type ReactNode } from "react";
import { C, PassportMark } from "./ui";

export type Tab = "home" | "menu" | "library" | "lists" | "messages" | "account";

const TABS: { id: Exclude<Tab, "account">; label: string; href: string; icon: ReactNode }[] = [
  { id: "home", label: "Home", href: "/passport", icon: <path d="M4 11.5 12 5l8 6.5V20a1 1 0 0 1-1 1h-4.5v-5.5h-5V21H5a1 1 0 0 1-1-1z" /> },
  { id: "menu", label: "Menu", href: "/passport/menu", icon: <><path d="M6 4h12l-6 8z" /><path d="M12 12v7M8.5 20h7" /></> },
  { id: "library", label: "Library", href: "/passport/library", icon: <><path d="M5 4.5h4.5v15H5zM10.5 4.5H15v15h-4.5z" /><path d="m16 5.2 3.3-.9 3 14.5-3.3.8z" /></> },
  { id: "lists", label: "Lists", href: "/passport/lists", icon: <><path d="M9 6.5h11M9 12h11M9 17.5h11" /><circle cx="4.5" cy="6.5" r="1" /><circle cx="4.5" cy="12" r="1" /><circle cx="4.5" cy="17.5" r="1" /></> },
  { id: "messages", label: "Messages", href: "/passport/messages", icon: <path d="M4 5.5h16v10H9.5L5 19.5v-4H4z" /> },
];

/** Registers the do-nothing background helper the home-screen install needs (no notifications yet: file 06). */
function useInstallHelper() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/passport/sw.js", { scope: "/passport/" }).catch(() => {});
  }, []);
}

/** The signed-in app frame: a small top bar and a music-app style bottom bar. */
export default function Shell({ tab, children }: { tab: Tab; children: ReactNode }) {
  useInstallHelper();
  return (
    <div className="min-h-[100dvh] flex flex-col" style={{ background: C.bg, color: C.text }}>
      <header className="sticky top-0 z-20 flex items-center justify-between px-5 pb-3 backdrop-blur"
        style={{ paddingTop: "max(env(safe-area-inset-top), 14px)", background: "rgba(19,23,15,0.92)", borderBottom: `1px solid ${C.line}` }}>
        <Link href="/passport" className="flex items-center gap-2.5">
          <PassportMark size={28} />
          <span className="font-body text-[11px] tracking-[0.4em] uppercase" style={{ color: C.brass }}>Passport</span>
        </Link>
        <Link href="/passport/account" aria-label="Your account"
          className={`w-9 h-9 rounded-full flex items-center justify-center border ${tab === "account" ? "border-[#C9A96E]" : "border-[#323B29]"}`}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={tab === "account" ? C.brass : C.muted} strokeWidth="1.6" aria-hidden>
            <circle cx="12" cy="8.5" r="3.5" /><path d="M5 20c1.2-3.6 4-5.5 7-5.5s5.8 1.9 7 5.5" />
          </svg>
        </Link>
      </header>
      <main className="flex-1 w-full max-w-xl mx-auto px-5 pt-6" style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 96px)" }}>
        {children}
      </main>
      <nav aria-label="Passport" className="fixed bottom-0 inset-x-0 z-30 border-t"
        style={{ background: "rgba(15,19,12,0.96)", borderColor: C.line, paddingBottom: "env(safe-area-inset-bottom)" }}>
        <ul className="max-w-xl mx-auto grid grid-cols-5">
          {TABS.map((t) => {
            const on = t.id === tab;
            return (
              <li key={t.id}>
                <Link href={t.href} aria-current={on ? "page" : undefined}
                  className="flex flex-col items-center gap-1 pt-2.5 pb-2 font-body text-[10px] tracking-[0.12em] uppercase"
                  style={{ color: on ? C.brass : C.faint }}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>{t.icon}</svg>
                  {t.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}

export function ComingSoon({ title, line }: { title: string; line: string }) {
  return (
    <div className="pt-10 text-center animate-fade-in">
      <div className="mx-auto w-12 h-px mb-6" style={{ background: C.brass, opacity: 0.6 }} />
      <h1 className="font-display text-4xl" style={{ color: C.text }}>{title}</h1>
      <p className="font-body text-sm mt-4 leading-relaxed max-w-xs mx-auto" style={{ color: C.muted }}>{line}</p>
      <p className="font-body text-[11px] tracking-[0.3em] uppercase mt-8" style={{ color: C.brass }}>Coming soon</p>
    </div>
  );
}
