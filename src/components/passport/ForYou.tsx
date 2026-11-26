"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { C } from "./theme";
import { postJson } from "./ui";
import { AddButton, Avail, PressLink } from "./bits";
import { Thumb } from "./PhotoBits";
import { useShell } from "./shellContext";
import { notifyChanged } from "./appEvents";
import type { Recommendation } from "@/lib/passport/types";

/**
 * File 12: "For you". Suggestions the Bible builds only from the member's own favorites, ratings, orders, lists and
 * notes, each with one plain reason. Home shows up to four (cocktails first); the Index's Yours shows up to twelve.
 * "Not for me" hides one at once on both (it stays away for 90 days); if the bar can't be reached it comes back.
 */

const hrefOf = (r: Recommendation) => (r.kind === "cocktail" ? `/passport/library/${r.id}` : `/passport/spirits/${r.id}`);
const keyOf = (r: Pick<Recommendation, "kind" | "id">) => `${r.kind}:${r.id}`;
const kickerOf = (r: Recommendation) => (r.kind === "cocktail" ? (r.passport === "current" ? "Passport cocktail" : "Cocktail") : r.category || "Spirit");

// One set of dismissed suggestions for the whole app, so Home and the Index agree at once.
let hidden = new Set<string>();
const listeners = new Set<() => void>();
const setHidden = (next: Set<string>) => { hidden = next; listeners.forEach((fn) => fn()); };
const subscribe = (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn); }; };
const useHidden = () => useSyncExternalStore(subscribe, () => hidden, () => hidden);

function useNotForMe() {
  const shell = useShell();
  return async (r: Recommendation) => {
    const k = keyOf(r);
    setHidden(new Set(hidden).add(k));
    shell?.toast(`We won't suggest ${r.name} for a while.`);
    const res = await postJson("/api/passport/recommendations/dismiss", { kind: r.kind, id: r.id });
    if (!res.ok) {
      const n = new Set(hidden);
      n.delete(k);
      setHidden(n);
      shell?.toast(res.data.error || "Couldn't do that. Please try again.");
      return;
    }
    notifyChanged("recs");
  };
}

function NotForMe({ r, onClick, className = "" }: { r: Recommendation; onClick: () => void; className?: string }) {
  return (
    <button type="button" onClick={onClick} aria-label={`Not for me: ${r.name}`}
      className={`inline-flex items-center min-h-[44px] px-1 -ml-1 font-body text-xs underline underline-offset-4 pp-focus rounded ${className}`} style={{ color: C.muted }}>
      Not for me
    </button>
  );
}

/** Home → "For you": up to four cards, cocktails first, side by side (they scroll sideways on a phone). */
export function ForYouHome({ items }: { items?: Recommendation[] | null }) {
  const gone = useHidden();
  const notForMe = useNotForMe();
  const shown = (items || []).filter((r) => !gone.has(keyOf(r))).slice(0, 4);
  if (!shown.length) return null;
  return (
    <section aria-labelledby="pp-for-you" className="mt-10">
      <h2 id="pp-for-you" className="font-body text-[11px] tracking-[0.3em] uppercase mb-3" style={{ color: C.brass }}>For you</h2>
      <ul className="pp-hscroll -mx-5 px-5 flex gap-3 overflow-x-auto pb-2 snap-x">
        {shown.map((r) => (
          <li key={keyOf(r)} className="snap-start shrink-0 w-[72%] max-w-[270px] flex flex-col rounded-xl border" style={{ borderColor: C.line, background: C.card }}>
            <PressLink item={{ kind: r.kind, id: r.id, name: r.name }} href={hrefOf(r)} className="block flex-1 p-4 pb-1 rounded-t-xl pp-focus pp-row">
              <span className="flex items-start justify-between gap-3">
                <span className="min-w-0">
                  <span className="flex items-center gap-2 font-body text-[10px] tracking-[0.25em] uppercase" style={{ color: C.brass }}>{kickerOf(r)} <Avail on={r.available} /></span>
                  <span className="block font-display text-[21px] leading-tight mt-1.5" style={{ color: C.text }}>{r.name}</span>
                </span>
                <Thumb kind={r.kind} id={r.id} photo={r.photo} size={44} />
              </span>
              <span className="block font-body text-[13px] leading-snug mt-2" style={{ color: C.muted }}>{r.reason}</span>
            </PressLink>
            <span className="px-4 pb-1"><NotForMe r={r} onClick={() => void notForMe(r)} /></span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * Index → Yours → "For you": up to twelve, cocktails first. Too little history: one quiet line. Switched off in
 * Account: a quiet line that says where to turn it on. Nothing to suggest today: nothing.
 */
export function ForYouIndex({ items, enough, suggest }: { items?: Recommendation[] | null; enough?: boolean; suggest?: boolean }) {
  const gone = useHidden();
  const notForMe = useNotForMe();
  const shown = (items || []).filter((r) => !gone.has(keyOf(r))).slice(0, 12);
  if (suggest === false) {
    return (
      <div className="mt-6">
        <h3 className="font-body text-[11px] tracking-[0.3em] uppercase mb-2" style={{ color: C.brass }}>For you</h3>
        <p className="font-body text-sm leading-relaxed" style={{ color: C.faint }}>
          Suggestions are off. <Link href="/passport/account" scroll={false} className="underline underline-offset-4 pp-focus rounded" style={{ color: C.muted }}>Turn them on in your account</Link>.
        </p>
      </div>
    );
  }
  if (!shown.length && enough) return null;
  return (
    <div className="mt-6" id="for-you">
      <h3 className="font-body text-[11px] tracking-[0.3em] uppercase mb-1" style={{ color: C.brass }}>For you</h3>
      {!shown.length ? (
        <p className="font-body text-sm leading-relaxed mt-2" style={{ color: C.faint }}>Favorite or rate a few things and we&rsquo;ll suggest what to try next.</p>
      ) : (
        <ul>
          {shown.map((r) => (
            <li key={keyOf(r)} className="flex items-start gap-1 border-b" style={{ borderColor: C.line }}>
              <div className="flex-1 min-w-0">
                <PressLink item={{ kind: r.kind, id: r.id, name: r.name }} href={hrefOf(r)} className="block pt-3 pb-0.5 pp-row pp-focus rounded-sm">
                  <span className="flex items-start gap-3">
                    <span className="flex-1 min-w-0 block">
                      <span className="flex items-center gap-2 flex-wrap">
                        <span className={r.kind === "cocktail" ? "font-display text-[21px] leading-tight" : "font-body text-[15px]"} style={{ color: C.text }}>{r.name}</span>
                        <Avail on={r.available} />
                      </span>
                      <span className="block font-body text-[11px] tracking-[0.12em] uppercase mt-1" style={{ color: C.faint }}>{kickerOf(r)}</span>
                      <span className="block font-body text-sm mt-1 leading-snug" style={{ color: C.muted }}>{r.reason}</span>
                    </span>
                    <Thumb kind={r.kind} id={r.id} photo={r.photo} size={r.kind === "cocktail" ? 52 : 40} />
                  </span>
                </PressLink>
                <NotForMe r={r} onClick={() => void notForMe(r)} />
              </div>
              <AddButton item={{ kind: r.kind, id: r.id, name: r.name }} className="-mr-2 mt-2" />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
