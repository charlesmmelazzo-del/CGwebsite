"use client";

import { createContext, useContext, useEffect, useId, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, Minus, Plus, X } from "lucide-react";
import type { ReserveFaq } from "@/lib/reserve/types";

// ── Theme ─────────────────────────────────────────────────────────────────────

export interface RvTheme {
  bg: string;
  text: string;
  muted: string;
}

const ThemeCtx = createContext<RvTheme>({ bg: "#3B5040", text: "#A8C4A0", muted: "#6a8a72" });

export function themeVars(t: RvTheme): CSSProperties {
  return { "--rv-bg": t.bg, "--rv-text": t.text, "--rv-muted": t.muted } as CSSProperties;
}

/** Root wrapper: sets the colour variables every reservation control reads. */
export function RvRoot({ theme, children, className = "" }: { theme: RvTheme; children: ReactNode; className?: string }) {
  return (
    <ThemeCtx.Provider value={theme}>
      <div className={`rv ${className}`} style={themeVars(theme)}>
        {children}
      </div>
    </ThemeCtx.Provider>
  );
}

// ── Modal ─────────────────────────────────────────────────────────────────────

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Open dialogs, innermost last: only the top one answers Escape and Tab (dialogs can nest). */
const openStack: number[] = [];
let nextModalId = 1;

/**
 * Accessible dialog: portalled to <body>, traps focus, closes on Escape or a
 * backdrop tap, locks page scroll, and scrolls its own body on short phones.
 */
export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  size = "md",
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  /** "full": a full-screen sheet on phones, a tall panel on larger screens. */
  size?: "sm" | "md" | "lg" | "full";
}) {
  const theme = useContext(ThemeCtx);
  const panel = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const [mounted, setMounted] = useState(false);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    const myId = nextModalId++;
    openStack.push(myId);
    const before = document.activeElement as HTMLElement | null;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    // Focus the first control (or the panel) once rendered.
    const id = requestAnimationFrame(() => {
      const el = panel.current;
      if (!el) return;
      const first = el.querySelector<HTMLElement>("[data-autofocus]") ?? el.querySelector<HTMLElement>(FOCUSABLE);
      (first ?? el).focus();
    });

    function onKey(e: KeyboardEvent) {
      if (openStack[openStack.length - 1] !== myId) return;
      if (e.key === "Escape") {
        e.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (e.key !== "Tab" || !panel.current) return;
      const items = Array.from(panel.current.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((n) => n.offsetParent !== null);
      if (!items.length) {
        e.preventDefault();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && (document.activeElement === first || document.activeElement === panel.current)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => {
      cancelAnimationFrame(id);
      document.removeEventListener("keydown", onKey);
      const at = openStack.indexOf(myId);
      if (at >= 0) openStack.splice(at, 1);
      document.body.style.overflow = prevOverflow;
      before?.focus?.();
    };
  }, [open]);

  if (!open || !mounted) return null;

  const maxW = size === "sm" ? 420 : size === "lg" ? 640 : size === "full" ? 760 : 520;
  const full = size === "full";

  return createPortal(
    <div
      className={`rv-dialog fixed inset-0 z-[60] flex ${full ? "items-stretch" : "items-end"} sm:items-center justify-center sm:p-4`}
      style={themeVars(theme)}
    >
      <div className="absolute inset-0 bg-black/60 animate-fade-in" onClick={onClose} aria-hidden="true" />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={`relative w-full flex flex-col shadow-2xl rv-step outline-none ${full ? "h-[100dvh] sm:h-[92vh]" : ""}`}
        style={{
          maxWidth: maxW,
          maxHeight: full ? undefined : "min(90dvh, 90vh)",
          background: theme.bg,
          border: `1px solid ${theme.muted}66`,
        }}
      >
        <div className="flex items-start justify-between gap-4 px-5 pt-5 pb-3 shrink-0">
          <h2 id={titleId} className="rv-h2 text-[1.25rem]">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="shrink-0 -mr-1 -mt-1 w-10 h-10 flex items-center justify-center rounded-full hover:bg-white/10"
          >
            <X size={18} />
          </button>
        </div>
        <div className="px-5 pb-5 overflow-y-auto overscroll-contain min-h-0 flex-1">{children}</div>
        {footer && (
          <div className="px-5 py-4 shrink-0" style={{ borderTop: `1px solid ${theme.muted}40` }}>
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}

// ── Controls ──────────────────────────────────────────────────────────────────

/** A toggle-style choice. Selection is announced with aria-pressed and shown with a check, not colour alone. */
export function Choice({
  pressed,
  onClick,
  children,
  disabled,
  className = "",
  lockedLabel,
}: {
  pressed: boolean;
  onClick?: () => void;
  children: ReactNode;
  disabled?: boolean;
  className?: string;
  /** When set, the choice is fixed (the only option) and explains why. */
  lockedLabel?: string;
}) {
  return (
    <button
      type="button"
      className={`rv-choice ${className}`}
      aria-pressed={pressed}
      aria-disabled={lockedLabel ? true : undefined}
      title={lockedLabel}
      onClick={lockedLabel ? undefined : onClick}
      disabled={disabled}
    >
      {pressed && <Check size={13} aria-hidden="true" className="shrink-0" />}
      {children}
    </button>
  );
}

export function SkeletonRow({ count = 4, w = 88, h = 44 }: { count?: number; w?: number; h?: number }) {
  return (
    <div className="flex flex-wrap gap-2" aria-hidden="true">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rv-skel" style={{ width: w, height: h }} />
      ))}
    </div>
  );
}

export function Loading({ label = "Loading" }: { label?: string }) {
  return (
    <span className="sr-only" role="status">
      {label}…
    </span>
  );
}

export function Stepper({
  value,
  min,
  max,
  onChange,
  label,
  id,
}: {
  value: number;
  min: number;
  max: number;
  onChange: (n: number) => void;
  label: string;
  id?: string;
}) {
  return (
    <div className="inline-flex items-stretch" role="group" aria-label={label}>
      <button
        type="button"
        className="rv-choice !px-0 w-11"
        onClick={() => onChange(Math.max(min, value - 1))}
        disabled={value <= min}
        aria-label={`Fewer (${label})`}
      >
        <Minus size={16} />
      </button>
      <output
        id={id}
        aria-live="polite"
        className="min-w-[64px] flex items-center justify-center text-2xl tabular-nums"
        style={{ fontFamily: "var(--font-display)" }}
      >
        {value}
      </output>
      <button
        type="button"
        className="rv-choice !px-0 w-11"
        onClick={() => onChange(Math.min(max, value + 1))}
        disabled={value >= max}
        aria-label={`More (${label})`}
      >
        <Plus size={16} />
      </button>
    </div>
  );
}

export function ErrorNote({ children }: { children: ReactNode }) {
  if (!children) return null;
  return (
    <p role="alert" className="text-sm mt-3" style={{ color: "#F0A090" }}>
      {children}
    </p>
  );
}

/** Honeypot: hidden from people, irresistible to form-filling bots. */
export function Honeypot({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div aria-hidden="true" style={{ position: "absolute", left: "-10000px", top: "auto", width: 1, height: 1, overflow: "hidden" }}>
      <label>
        Company
        <input
          type="text"
          name="company"
          tabIndex={-1}
          autoComplete="off"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      </label>
    </div>
  );
}

// ── Service "More info" ───────────────────────────────────────────────────────

/** A small "More info" button that opens the service description staff wrote in the CG Bible. */
export function ServiceInfoButton({ heading, description, className = "" }: { heading: string; description: string; className?: string }) {
  const [open, setOpen] = useState(false);
  if (!description.trim()) return null;
  return (
    <>
      <button
        type="button"
        className={`rv-link text-sm shrink-0 ${className}`}
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-label={`More info about ${heading}`}
      >
        More info
      </button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        size="sm"
        title={heading}
        footer={
          <button type="button" className="rv-btn rv-btn-ghost w-full" onClick={() => setOpen(false)}>
            Close
          </button>
        }
      >
        <p className="whitespace-pre-line leading-relaxed opacity-90">{description}</p>
      </Modal>
    </>
  );
}

// ── FAQ ───────────────────────────────────────────────────────────────────────

export function FaqModal({ open, onClose, faq }: { open: boolean; onClose: () => void; faq: ReserveFaq[] }) {
  const [openId, setOpenId] = useState<string | null>(null);
  return (
    <Modal open={open} onClose={onClose} title="Frequently asked questions" size="lg">
      {faq.length === 0 ? (
        <p className="opacity-70">No questions yet.</p>
      ) : (
        <ul className="divide-y" style={{ borderColor: "var(--rv-line)" }}>
          {faq.map((f) => {
            const isOpen = openId === f.id;
            const panelId = `faq-${f.id}`;
            return (
              <li key={f.id} style={{ borderColor: "var(--rv-line)" }}>
                <h3>
                  <button
                    type="button"
                    className="w-full flex items-center justify-between gap-4 py-4 text-left"
                    aria-expanded={isOpen}
                    aria-controls={panelId}
                    onClick={() => setOpenId(isOpen ? null : f.id)}
                  >
                    <span className="text-[15px] leading-snug">{f.question}</span>
                    <ChevronDown
                      size={16}
                      aria-hidden="true"
                      className="shrink-0 transition-transform"
                      style={{ transform: isOpen ? "rotate(180deg)" : "none" }}
                    />
                  </button>
                </h3>
                <div id={panelId} hidden={!isOpen} className="pb-4 text-sm leading-relaxed whitespace-pre-line opacity-85">
                  {f.answer}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Modal>
  );
}

// ── Fetch helper ──────────────────────────────────────────────────────────────

export class ApiError extends Error {
  status: number;
  body: Record<string, unknown>;
  constructor(status: number, message: string, body: Record<string, unknown>) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

export const GENERIC_ERROR = "Something went wrong. Please try again, or call us.";

export async function api<T>(url: string, init?: { method?: string; body?: unknown; signal?: AbortSignal }): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, {
      method: init?.method ?? (init?.body ? "POST" : "GET"),
      headers: init?.body ? { "Content-Type": "application/json" } : undefined,
      body: init?.body ? JSON.stringify(init.body) : undefined,
      cache: "no-store",
      signal: init?.signal,
    });
  } catch (e) {
    if ((e as Error)?.name === "AbortError") throw e;
    throw new ApiError(0, "We couldn't reach the server. Check your connection and try again.", {});
  }
  let data: Record<string, unknown> = {};
  try {
    data = await res.json();
  } catch {
    /* empty body */
  }
  if (!res.ok) {
    throw new ApiError(res.status, typeof data.error === "string" ? data.error : GENERIC_ERROR, data);
  }
  return data as T;
}
