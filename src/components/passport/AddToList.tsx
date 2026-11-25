"use client";

import { useEffect, useRef, useState, type MutableRefObject } from "react";
import { C } from "./theme";
import { inputCls, postJson } from "./ui";
import { Skel } from "./bits";
import { notifyChanged } from "./appEvents";
import type { AddTarget } from "./shellContext";
import type { PassportList } from "@/lib/passport/types";

/**
 * File 06: "+ add to list", one gesture. A bottom sheet of the member's lists that hold this kind of item, with
 * "New list" at the top. One tap adds and confirms with a brief message. Everything goes through /api/passport/lists,
 * which only ever acts for the signed-in member.
 */
export default function AddToList({ target, onClose, toast, cache }: {
  target: AddTarget; onClose: () => void; toast: (m: string) => void; cache: MutableRefObject<PassportList[] | null>;
}) {
  const [lists, setLists] = useState<PassportList[] | null>(cache.current);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<number | "new" | null>(null);
  const [making, setMaking] = useState(false);
  const [name, setName] = useState("");
  const [ranked, setRanked] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const opener = useRef<Element | null>(null);
  const kindWord = target.kind === "cocktail" ? "cocktail" : "bottle";

  // Fresh lists every time it opens (the last copy shows at once while they arrive).
  useEffect(() => {
    let live = true;
    fetch("/api/passport/lists", { cache: "no-store" }).then((r) => r.json().then((d) => ({ ok: r.ok, d }))).then(({ ok, d }) => {
      if (!live) return;
      if (ok && Array.isArray(d.lists)) { cache.current = d.lists; setLists(d.lists); } else if (!cache.current) setError(d.error || "Couldn't load your lists. Please try again.");
    }).catch(() => { if (live && !cache.current) setError("You seem to be offline."); });
    return () => { live = false; };
  }, [cache]);

  // Keyboard: focus moves into the sheet, Escape closes it, Tab stays inside, and focus returns to the "+" after.
  useEffect(() => {
    opener.current = document.activeElement;
    box.current?.querySelector<HTMLElement>("[data-autofocus]")?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); onClose(); return; }
      if (e.key !== "Tab" || !box.current) return;
      const f = Array.from(box.current.querySelectorAll<HTMLElement>("button, input, [href], [tabindex]:not([tabindex='-1'])")).filter((x) => !x.hasAttribute("disabled"));
      if (!f.length) return;
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("keydown", onKey); (opener.current as HTMLElement | null)?.focus?.(); };
  }, [onClose]);

  const add = async (l: PassportList) => {
    setBusy(l.id); setError("");
    const r = await postJson<{ list: PassportList }>(`/api/passport/lists/${l.id}/items`, { id: target.id });
    setBusy(null);
    if (r.ok) { notifyChanged("lists"); toast(`Added to ${l.name}`); onClose(); return; }
    if (r.data.signed_out) { window.location.assign("/passport?signed_out=1"); return; }
    setError(r.data.error || "Couldn't add it. Please try again.");
  };
  const makeAndAdd = async () => {
    setBusy("new"); setError("");
    const made = await postJson<{ list: PassportList }>("/api/passport/lists", { name, kind: target.kind, ranked });
    if (!made.ok) { setBusy(null); setError(made.data.error || "Couldn't make the list. Please try again."); return; }
    const r = await postJson(`/api/passport/lists/${made.data.list.id}/items`, { id: target.id });
    setBusy(null);
    notifyChanged("lists");
    if (r.ok) { toast(`Made “${made.data.list.name}” and added it`); onClose(); } else setError(r.data.error || "The list was made, but adding didn't work. Please try again.");
  };

  const mine = (lists || []).filter((l) => l.kind === target.kind);
  const btn = "w-full flex items-center justify-between gap-3 text-left min-h-[56px] px-5 py-3 pp-focus";
  return (
    <div className="fixed inset-0 z-[70]">
      <div className="pp-backdrop absolute inset-0" style={{ background: "rgba(8,10,6,0.62)" }} onClick={onClose} aria-hidden />
      <div ref={box} role="dialog" aria-modal="true" aria-labelledby="pp-add-title"
        className="pp-sheet absolute inset-x-0 bottom-0 mx-auto max-w-xl rounded-t-2xl border-t shadow-2xl flex flex-col"
        style={{ background: C.card, borderColor: C.line, maxHeight: "min(78dvh, 640px)", paddingBottom: "env(safe-area-inset-bottom)" }}>
        <div className="pt-2.5 pb-1 flex justify-center" aria-hidden><span className="w-10 h-1 rounded-full" style={{ background: C.line }} /></div>
        <div className="px-5 pb-3 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 id="pp-add-title" className="font-body text-[11px] tracking-[0.3em] uppercase" style={{ color: C.brass }}>Add to a list</h2>
            <p className="font-display text-[22px] leading-tight mt-1 truncate" style={{ color: C.text }}>{target.name}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="w-11 h-11 -mr-2 rounded-full flex items-center justify-center pp-focus shrink-0" style={{ color: C.muted }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden><path d="M6 6l12 12M18 6 6 18" /></svg>
          </button>
        </div>
        <div className="overflow-y-auto pp-overlay border-t" style={{ borderColor: C.line }}>
          {making ? (
            <form className="px-5 py-4 space-y-3 border-b" style={{ borderColor: C.line }} onSubmit={(e) => { e.preventDefault(); if (name.trim()) void makeAndAdd(); }}>
              <input autoFocus value={name} onChange={(e) => setName(e.target.value)} maxLength={60} className={inputCls} aria-label="Name of the new list"
                placeholder={target.kind === "cocktail" ? "e.g. Date night" : "e.g. Top 10 rums"} />
              <div role="radiogroup" aria-label="Kind of list" className="flex gap-2">
                {([[false, "Playlist"], [true, "Top 10"]] as const).map(([v, l]) => (
                  <button key={l} type="button" role="radio" aria-checked={ranked === v} onClick={() => setRanked(v)}
                    className="rounded-full border px-4 min-h-[40px] font-body text-[12px] tracking-[0.08em] pp-focus"
                    style={ranked === v ? { borderColor: C.brass, color: C.brass, background: "#1a1f14" } : { borderColor: C.line, color: C.muted }}>{l}</button>
                ))}
              </div>
              <div className="flex gap-2">
                <button type="submit" disabled={!name.trim() || busy !== null} className="rounded-full px-5 min-h-[44px] font-body text-[12px] tracking-[0.14em] uppercase disabled:opacity-50 pp-focus"
                  style={{ background: C.brass, color: C.bg }}>{busy === "new" ? "One moment…" : "Make list and add"}</button>
                <button type="button" onClick={() => setMaking(false)} className="rounded-full border px-4 min-h-[44px] font-body text-[12px] tracking-[0.14em] uppercase pp-focus" style={{ borderColor: C.line, color: C.muted }}>Cancel</button>
              </div>
            </form>
          ) : (
            <button type="button" data-autofocus onClick={() => setMaking(true)} className={`${btn} border-b`} style={{ borderColor: C.line }}>
              <span className="flex items-center gap-3">
                <span className="w-9 h-9 rounded-full border flex items-center justify-center" style={{ borderColor: C.brass, color: C.brass }} aria-hidden>+</span>
                <span className="font-body text-[15px]" style={{ color: C.text }}>New list</span>
              </span>
            </button>
          )}
          {error && <p role="alert" className="px-5 py-3 font-body text-sm" style={{ color: "#f0c4b2" }}>{error}</p>}
          {lists === null && !error ? (
            <div className="px-5 py-4 space-y-4" aria-label="Loading your lists" role="status"><Skel w="60%" h={16} /><Skel w="45%" h={16} /><Skel w="52%" h={16} /></div>
          ) : (
            <ul>
              {mine.map((l) => {
                const full = l.cap !== null && l.count >= l.cap;
                return (
                  <li key={l.id} className="border-b" style={{ borderColor: C.line }}>
                    <button type="button" disabled={busy !== null || full} onClick={() => add(l)} className={`${btn} disabled:opacity-50`}>
                      <span className="min-w-0">
                        <span className="block font-display text-[19px] leading-tight truncate" style={{ color: C.text }}>{l.name}</span>
                        <span className="block font-body text-[11px] tracking-[0.12em] uppercase mt-0.5" style={{ color: C.faint }}>
                          {l.ranked ? "Top 10" : "Playlist"} · {l.count} {kindWord}{l.count === 1 ? "" : "s"}{full ? " · full" : ""}
                        </span>
                      </span>
                      <span className="font-body text-xs shrink-0" style={{ color: C.brass }}>{busy === l.id ? "Adding…" : "Add"}</span>
                    </button>
                  </li>
                );
              })}
              {lists !== null && !mine.length && !making && (
                <li className="px-5 py-4 font-body text-sm" style={{ color: C.faint }}>Your {kindWord} lists will show here. Start one with New list.</li>
              )}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
