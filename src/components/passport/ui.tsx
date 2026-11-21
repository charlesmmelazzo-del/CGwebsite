"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * Shared look for Passport: deep olive, cream type, the Common Good serif for
 * headings and a thin brass rule, like the inside cover of a passport.
 */

export const C = {
  bg: "#13170F",
  card: "#1B2016",
  line: "#323B29",
  text: "#EDE6D3",
  muted: "#97A586",
  faint: "#6B7860",
  brass: "#C9A96E",
  accent: "#C97D5A",
};

export function PassportMark({ size = 72 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden>
      <circle cx="50" cy="50" r="47" fill="none" stroke={C.brass} strokeWidth="1.5" />
      <circle cx="50" cy="50" r="41" fill="none" stroke={C.brass} strokeWidth="0.6" opacity="0.7" />
      <text x="50" y="58" textAnchor="middle" fontFamily="KorinthSerial, Cormorant Garamond, Georgia, serif" fontSize="30" fill={C.brass} letterSpacing="1">CG</text>
      <path d="M28 70 H72" stroke={C.brass} strokeWidth="0.6" opacity="0.7" />
      <path d="M34 32 H66" stroke={C.brass} strokeWidth="0.6" opacity="0.7" />
    </svg>
  );
}

/** The centred frame for the signed-out screens (sign in, forgot, set password, sign up). */
export function Cover({ title, subtitle, children, footer }: { title: string; subtitle?: ReactNode; children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="min-h-[100dvh] flex flex-col items-center px-5 pb-10" style={{ paddingTop: "max(env(safe-area-inset-top), 40px)" }}>
      <div className="w-full max-w-sm flex flex-col items-center animate-fade-in">
        <PassportMark />
        <p className="mt-5 text-[11px] tracking-[0.45em] uppercase" style={{ color: C.brass }}>Common Good</p>
        <h1 className="font-display text-[44px] leading-none mt-2" style={{ color: C.text }}>Passport</h1>
        <div className="w-16 h-px my-6" style={{ background: C.brass, opacity: 0.6 }} />
        <h2 className="font-display text-2xl text-center" style={{ color: C.text }}>{title}</h2>
        {subtitle && <p className="font-body text-sm text-center mt-2 leading-relaxed" style={{ color: C.muted }}>{subtitle}</p>}
        <div className="w-full mt-7">{children}</div>
        {footer && <div className="w-full mt-8 text-center font-body text-sm" style={{ color: C.muted }}>{footer}</div>}
      </div>
    </div>
  );
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: ReactNode }) {
  return (
    <label className="block">
      <span className="block font-body text-[11px] tracking-[0.2em] uppercase mb-1.5" style={{ color: C.muted }}>{label}</span>
      {children}
      {hint && <span className="block font-body text-xs mt-1.5" style={{ color: C.faint }}>{hint}</span>}
    </label>
  );
}

export const inputCls =
  "w-full rounded-lg px-4 py-3 font-body text-[16px] bg-[#0E120B] border border-[#323B29] text-[#EDE6D3] placeholder:text-[#5d6a52] focus:outline-none focus:border-[#C9A96E] focus:ring-1 focus:ring-[#C9A96E]/40 transition-colors";

export function Button({ children, busy, disabled, type = "submit", onClick, kind = "primary", className = "" }: {
  children: ReactNode; busy?: boolean; disabled?: boolean; type?: "submit" | "button"; onClick?: () => void; kind?: "primary" | "quiet"; className?: string;
}) {
  const style = kind === "primary"
    ? "bg-[#C9A96E] text-[#13170F] hover:bg-[#d6b77d]"
    : "bg-transparent border border-[#3e4934] text-[#EDE6D3] hover:border-[#C9A96E]";
  return (
    <button type={type} onClick={onClick} disabled={disabled || busy}
      className={`w-full rounded-lg py-3.5 font-body text-[13px] tracking-[0.22em] uppercase transition-colors disabled:opacity-50 ${style} ${className}`}>
      {busy ? "One moment…" : children}
    </button>
  );
}

export function TextLink({ href, children }: { href: string; children: ReactNode }) {
  return <Link href={href} className="underline underline-offset-4 decoration-[#C9A96E]/60 hover:text-[#EDE6D3]" style={{ color: C.text }}>{children}</Link>;
}

export function Notice({ kind = "error", children }: { kind?: "error" | "ok"; children: ReactNode }) {
  const cls = kind === "error" ? "border-[#7a3f2c] bg-[#2a1712] text-[#f0c4b2]" : "border-[#4c5a3c] bg-[#1d2517] text-[#d9e3c8]";
  return <p role={kind === "error" ? "alert" : "status"} className={`rounded-lg border px-4 py-3 font-body text-sm leading-relaxed ${cls}`}>{children}</p>;
}

export function Check({ checked, onChange, children }: { checked: boolean; onChange: (v: boolean) => void; children: ReactNode }) {
  return (
    <label className="flex items-start gap-3 font-body text-sm leading-relaxed cursor-pointer" style={{ color: C.text }}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)}
        className="mt-1 w-[18px] h-[18px] shrink-0 accent-[#C9A96E]" />
      <span>{children}</span>
    </label>
  );
}

/**
 * The same quiet bot protection as the Reserve page: a hidden field people never
 * see, and the time the form appeared (a submit faster than a person could type is refused).
 */
export function useBotFields() {
  const rendered = useRef(0);
  const [company, setCompany] = useState("");
  useEffect(() => { rendered.current = Date.now(); }, []);
  const trap = (
    <div aria-hidden="true" style={{ position: "absolute", left: "-10000px", width: 1, height: 1, overflow: "hidden" }}>
      <label>Company<input tabIndex={-1} autoComplete="off" value={company} onChange={(e) => setCompany(e.target.value)} name="company" /></label>
    </div>
  );
  return { trap, fields: () => ({ company, rendered_at: rendered.current }) };
}

export async function postJson<T = Record<string, unknown>>(url: string, body: unknown, method = "POST"): Promise<{ ok: boolean; status: number; data: T & { error?: string; signed_out?: boolean } }> {
  try {
    const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), cache: "no-store" });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, data };
  } catch {
    return { ok: false, status: 0, data: { error: "You seem to be offline. Check your connection and try again." } as T & { error: string } };
  }
}
