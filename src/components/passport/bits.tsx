"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { C } from "./theme";
import { currentStep, hasAppHistory, previousStep } from "./appEvents";
import { parentOf } from "@/lib/passport/nav";
import { useShell, type AddTarget } from "./shellContext";

/** File 06: small pieces shared by the tabs and the pages that open over them. */

export const GREEN = "#86C07A";

/** "Available now": a small green dot (never a whole green row), with words for screen readers. */
export function Avail({ on }: { on?: boolean }) {
  if (!on) return null;
  return (
    <span className="inline-flex items-center shrink-0" title="Available now">
      <span aria-hidden className="inline-block w-2 h-2 rounded-full" style={{ background: GREEN, boxShadow: `0 0 0 2px ${GREEN}26` }} />
      <span className="sr-only">Available now</span>
    </span>
  );
}

/** A light placeholder shaped like the content, while it arrives. */
export function Skel({ w = "100%", h = 14, className = "", round = false }: { w?: string | number; h?: number; className?: string; round?: boolean }) {
  return <span aria-hidden className={`pp-skel block ${round ? "rounded-full" : "rounded"} ${className}`} style={{ width: w, height: h }} />;
}
export function SkelRows({ n = 6, tall = false }: { n?: number; tall?: boolean }) {
  return (
    <ul aria-hidden>
      {Array.from({ length: n }, (_, i) => (
        <li key={i} className="py-3.5 border-b space-y-2" style={{ borderColor: C.line }}>
          <Skel w={`${55 + ((i * 17) % 35)}%`} h={tall ? 20 : 15} />
          {tall && <Skel w={`${35 + ((i * 11) % 30)}%`} h={11} />}
        </li>
      ))}
    </ul>
  );
}
/** The frame of a screen while it loads: a title and rows. */
export function ScreenSkeleton({ rows = 7, cards = 0 }: { rows?: number; cards?: number }) {
  return (
    <div role="status" aria-label="Loading">
      <Skel w={90} h={10} />
      <Skel w="45%" h={34} className="mt-2 mb-7" />
      {Array.from({ length: cards }, (_, i) => (
        <div key={i} className="rounded-xl border p-5 mb-4 space-y-2.5" style={{ borderColor: C.line }}>
          <Skel w="55%" h={22} /><Skel w="80%" h={12} /><Skel w="65%" h={12} />
        </div>
      ))}
      <SkelRows n={rows} tall />
    </div>
  );
}

/** When a tab couldn't load: a plain line and a way to try again (never a dead end). */
export function ViewError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="pt-8 text-center" role="alert">
      <p className="font-body text-sm leading-relaxed" style={{ color: C.muted }}>{message}</p>
      <button type="button" onClick={onRetry} className="mt-4 rounded-full border px-5 min-h-[44px] font-body text-[0.875rem] tracking-[0.18em] uppercase pp-focus"
        style={{ borderColor: C.brass, color: C.brass }}>Try again</button>
    </div>
  );
}

/**
 * File 15, Part B: Back, at the top left of every screen below a tab's top level, in the same place and style everywhere.
 * It goes one level up: back in the app's own history when the step before is in the same tab (the place the member came
 * from; for an Index or Spirits level, only when that step is exactly the level above), otherwise to the place one level
 * up in the navigation model (lib/passport/nav.ts parentOf), never browser-back into another tab. `fallback` is used
 * only for an address the model does not know.
 */
export function BackLink({ fallback = "/passport", label = "Back", exact = false, to }: { fallback?: string; label?: string; exact?: boolean; to?: { href: string; label: string } }) {
  const router = useRouter();
  const [where, setWhere] = useState<{ href: string; label: string }>(to || { href: fallback, label });
  useEffect(() => {
    if (to) { setWhere(to); return; }
    const p = parentOf(window.location.pathname, window.location.search);
    setWhere(p ? { href: p.href, label: p.label } : { href: fallback, label });
  }, [to, fallback, label]);
  return (
    <a href={where.href} aria-label={`Back to ${where.label}`} data-pp-back onClick={(e) => {
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
      e.preventDefault();
      const prev = previousStep();
      const cur = currentStep();
      const sameTab = !!(prev && cur && prev.tab === cur.tab);
      const sameUrl = (u: string, v: string) => { try { const a = new URL(u, window.location.origin); const b2 = new URL(v, window.location.origin); return a.pathname.replace(/\/+$/, "") === b2.pathname.replace(/\/+$/, "") && a.search === b2.search; } catch { return u === v; } };
      if (hasAppHistory() && window.history.length > 1 && sameTab && (!exact || sameUrl(prev!.url, where.href))) router.back();
      else router.push(where.href, { scroll: false });
    }} className="pp-back inline-flex items-center gap-1.5 -ml-1 px-1 min-h-[44px] font-body text-[0.875rem] tracking-[0.2em] uppercase pp-focus rounded" style={{ color: C.muted }}>
      <span aria-hidden>←</span> Back
    </a>
  );
}

/** "+": add this cocktail or bottle to one of the member's lists (opens the sheet). */
export function AddButton({ item, className = "", style }: { item: AddTarget; className?: string; style?: CSSProperties }) {
  const shell = useShell();
  if (!shell) return null;
  return (
    <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); shell.openAdd(item); }}
      aria-label={`Add ${item.name} to a list`} title="Add to a list" aria-haspopup="dialog"
      className={`w-11 h-11 shrink-0 rounded-full flex items-center justify-center pp-focus pp-press ${className}`} style={{ color: C.muted, ...style }}>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden>
        <circle cx="12" cy="12" r="9" /><path d="M12 8v8M8 12h8" />
      </svg>
    </button>
  );
}

/** Long-press (or right-click) on a card opens the same sheet as its "+"; the tap that follows doesn't open the page. */
export function useLongPress(item: AddTarget | null) {
  const shell = useShell();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const start = useRef<{ x: number; y: number } | null>(null);
  const fired = useRef(false);
  const clear = () => { if (timer.current) clearTimeout(timer.current); timer.current = null; start.current = null; };
  useEffect(() => clear, []);
  if (!item || !shell) return {};
  const fire = () => {
    fired.current = true;
    clear();
    try { navigator.vibrate?.(10); } catch { /* not supported */ }
    shell.openAdd(item);
  };
  return {
    onPointerDown: (e: React.PointerEvent) => {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      fired.current = false;
      start.current = { x: e.clientX, y: e.clientY };
      timer.current = setTimeout(fire, 480);
    },
    onPointerMove: (e: React.PointerEvent) => {
      if (start.current && Math.hypot(e.clientX - start.current.x, e.clientY - start.current.y) > 10) clear();
    },
    onPointerUp: clear,
    onPointerCancel: clear,
    onPointerLeave: clear,
    onContextMenu: (e: React.MouseEvent) => { e.preventDefault(); if (!fired.current) fire(); },
    onClickCapture: (e: React.MouseEvent) => { if (fired.current) { e.preventDefault(); e.stopPropagation(); fired.current = false; } },
  };
}

/**
 * One cocktail or bottle in a list: the row opens its page (over the list), "+" adds it to a list, long-press does too.
 * lazy: the browser skips drawing the row until it is near the screen (long lists stay smooth).
 */
export function ItemRow({ item, href, children, pad = "py-3", lazy = false, border = true }: {
  item: AddTarget | null; href: string | null; children: ReactNode; pad?: string; lazy?: boolean; border?: boolean;
}) {
  const press = useLongPress(href ? item : null);
  const style: CSSProperties = { borderColor: C.line, ...(lazy ? { contentVisibility: "auto", containIntrinsicSize: "auto 56px" } : {}) };
  return (
    <li className={`flex items-center gap-1 ${border ? "border-b" : ""}`} style={style}>
      {href
        ? <Link href={href} scroll={false} {...press} className={`flex-1 min-w-0 block ${pad} pp-row pp-focus rounded-sm`}>{children}</Link>
        : <div className={`flex-1 min-w-0 ${pad}`}>{children}</div>}
      {href && item && <AddButton item={item} className="-mr-2" />}
    </li>
  );
}

/** A link card that also answers a long-press with the "+ add to list" sheet. */
export function PressLink({ item, href, className, style, children }: { item: AddTarget; href: string; className?: string; style?: CSSProperties; children: ReactNode }) {
  const press = useLongPress(item);
  return <Link href={href} scroll={false} {...press} className={className} style={style}>{children}</Link>;
}

/** A section that starts closed and shows its count; opens smoothly (instantly with "reduce motion"). */
export function Collapsible({ title, count, children, id }: { title: string; count: number; children: ReactNode; id?: string }) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const regionId = useId();
  const toggle = () => {
    if (open) { setOpen(false); return; }
    setMounted(true);
    requestAnimationFrame(() => requestAnimationFrame(() => setOpen(true)));
  };
  return (
    <section id={id} className="border-b" style={{ borderColor: C.line }}>
      <h3>
        <button type="button" onClick={toggle} aria-expanded={open} aria-controls={regionId}
          className="w-full flex items-center justify-between gap-3 min-h-[52px] py-2 text-left pp-focus rounded-sm">
          <span className="font-body text-[0.875rem] tracking-[0.16em] uppercase" style={{ color: C.text }}>{title}</span>
          <span className="flex items-center gap-3 shrink-0">
            <span className="font-body text-[0.875rem] tabular-nums" style={{ color: C.faint }}>{count}</span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.muted} strokeWidth="2" aria-hidden className="pp-chev" style={{ transform: open ? "rotate(180deg)" : "none" }}>
              <path d="m6 9 6 6 6-6" />
            </svg>
          </span>
        </button>
      </h3>
      <div id={regionId} className="pp-collapse" data-open={open ? "" : undefined}>
        <div className="overflow-hidden">{mounted ? children : null}</div>
      </div>
    </section>
  );
}

/**
 * File 12: a list of cards that stays scannable on Home. File 14: three or fewer stack; more than three scroll sideways
 * (each card most of the screen wide, the next one peeking in), with "See all" opening where they all live (the right
 * Index level, the Inbox, the Menu's tab). Without an address, "See all" opens them here as before. Nothing when empty.
 */
export function SeeAll<T>({ items, render, keyOf, max = 3, what = "", href }: { items: T[]; render: (item: T) => ReactNode; keyOf: (item: T) => string; max?: number; what?: string; href?: string }) {
  const [all, setAll] = useState(false);
  if (!items.length) return null;
  if (items.length <= max || all) {
    return (
      <>
        <ul className="space-y-3">{items.map((x) => <li key={keyOf(x)}>{render(x)}</li>)}</ul>
        {all && <button type="button" onClick={() => setAll(false)} className="mt-2 inline-flex items-center min-h-[44px] pp-t-secondary underline underline-offset-4 pp-focus rounded" style={{ color: C.muted }}>Show fewer</button>}
      </>
    );
  }
  const label = `See all ${items.length}${what ? ` ${what}` : ""}`;
  return (
    <>
      <ul className="pp-tabs -mx-5 px-5 flex gap-3 overflow-x-auto pb-2 snap-x snap-mandatory" aria-label={what ? `${items.length} ${what}, scroll sideways` : undefined}>
        {items.map((x) => <li key={keyOf(x)} className="snap-start shrink-0 w-[80%] max-w-[340px] [&>*]:h-full">{render(x)}</li>)}
      </ul>
      {href
        ? <Link href={href} scroll={false} className="mt-1 inline-flex items-center min-h-[44px] pp-t-secondary underline underline-offset-4 pp-focus rounded" style={{ color: C.text }}>{label} <span aria-hidden className="ml-1">→</span></Link>
        : <button type="button" onClick={() => setAll(true)} aria-expanded={false} className="mt-1 inline-flex items-center min-h-[44px] pp-t-secondary underline underline-offset-4 pp-focus rounded" style={{ color: C.text }}>{label}</button>}
    </>
  );
}
