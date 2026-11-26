"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor, TouchSensor, useSensor, useSensors, type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { C, Notice, inputCls, postJson } from "./ui";
import { PRIVATE_LINE, itemHref } from "./personalShared";
import { ShareButton } from "./Social";
import { createSaveQueue } from "@/lib/passport/saveQueue";
import type { Bespoke, BespokeLine, ItemKind, ListItem, Mine, PassportList, Pick } from "@/lib/passport/types";
import { notifyChanged } from "./appEvents";
import { BackLink } from "./bits";
import { Collage } from "./Drill";
import { listCovers } from "@/lib/passport/nav";
import { useShell } from "./shellContext";
import { ACCENTS } from "@/lib/passport/accents";

/**
 * File 04: the member's own favorites, ratings, notes, lists and bespoke recipes (client pieces).
 * Everything goes through /api/passport/*, which only ever acts for the signed-in member.
 */

const OFFLINE = "Couldn't save that. Please try again.";

function useAct() {
  const router = useRouter();
  const [error, setError] = useState("");
  const run = async <T,>(url: string, body: unknown, method: string): Promise<(T & { error?: string }) | null> => {
    setError("");
    const r = await postJson<T>(url, body, method);
    if (r.ok) return r.data;
    if (r.data.signed_out) { router.refresh(); return null; }
    setError(r.data.error || OFFLINE);
    return null;
  };
  return { run, error, setError, router };
}

function longDate(d: string | null) {
  if (!d) return "";
  return new Date(`${d.slice(0, 10)}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

const smallBtn = "rounded-full border px-3.5 min-h-[44px] font-body text-[0.875rem] tracking-[0.08em] transition-colors disabled:opacity-50 pp-focus";

// ── A cocktail or bottle page: favorite, stars, note, and whether they've ordered it ──
// No tap is ever lost (lib/passport/saveQueue.ts): each tap shows at once and the saves go to the server in order.
export function ItemControls({ kind, id, name, initial }: { kind: ItemKind; id: number; name: string; initial: Mine }) {
  const router = useRouter();
  const shell = useShell();
  const [error, setError] = useState("");
  const [mine, setMine] = useState(initial);
  const [draft, setDraft] = useState(initial.note);
  const [editing, setEditing] = useState(false);
  const [saved, setSaved] = useState(false);
  const [queue] = useState(() => createSaveQueue<Mine>(initial, { view: setMine, error: setError, signedOut: () => router.refresh() }));
  const save = async (url: string, body: Record<string, unknown>, patch: Partial<Mine>, what: string) => {
    setError("");
    const ok = await queue.push({
      patch, what,
      send: async () => {
        const r = await postJson<{ mine: Mine | null }>(url, body, "PUT");
        if (r.ok) return { ok: true, state: r.data.mine };
        return { ok: false, signedOut: !!r.data.signed_out, error: r.data.error };
      },
    });
    // File 06: the hearts and stars on the Menu and Index cards follow (the same record wherever it is opened).
    if (ok && what !== "your note") notifyChanged("marks");
    return ok;
  };
  // Each tap starts from what the screen shows now (including taps still waiting), never from a stale copy.
  const toggleFav = () => { const on = !queue.current().favorite; return save("/api/passport/favorite", { kind, id, on }, { favorite: on }, "your favorite"); };
  const rate = (n: number | null) => save("/api/passport/rating", { id, stars: n }, { rating: n }, "your rating");
  const saveNote = async (text: string) => {
    if (await save("/api/passport/note", { kind, id, body: text }, { note: text.trim() }, "your note")) { setEditing(false); setSaved(true); setTimeout(() => setSaved(false), 2500); }
  };
  return (
    <section className="mt-8 rounded-xl border p-5 space-y-5" style={{ borderColor: C.line, background: C.card }} aria-label="Your journal">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <button type="button" onClick={toggleFav} aria-pressed={mine.favorite}
          className={smallBtn} style={mine.favorite ? { borderColor: C.accent, color: C.accent } : { borderColor: C.line, color: C.text }}>
          <span aria-hidden>{mine.favorite ? "♥" : "♡"}</span> {mine.favorite ? "Favorite" : "Add to favorites"}
        </button>
        {shell && (
          <button type="button" onClick={() => shell.openAdd({ kind, id, name })} aria-haspopup="dialog" className={smallBtn} style={{ borderColor: C.line, color: C.text }}>
            <span aria-hidden>+</span> Add to a list
          </button>
        )}
        {kind === "cocktail" && (
          <div className="flex items-center gap-1" role="group" aria-label="Your rating">
            {[1, 2, 3, 4, 5].map((n) => (
              <button key={n} type="button" onClick={() => rate(mine.rating === n ? null : n)} aria-label={`${n} star${n === 1 ? "" : "s"}`} aria-pressed={mine.rating === n}
                className="w-10 h-11 text-[1.5rem] leading-none pp-focus rounded" style={{ color: mine.rating && n <= mine.rating ? C.brass : C.line }}>★</button>
            ))}
            {mine.rating ? <button type="button" onClick={() => rate(null)} className="font-body text-[0.75rem] underline ml-1" style={{ color: C.faint }}>Clear</button> : null}
          </div>
        )}
      </div>

      <p className="font-body text-sm" style={{ color: C.muted }}>
        {mine.ordered_count > 0
          ? mine.ordered_household
            // File 13: the count includes household members' checks (they share order history); only the member's own date shows.
            ? <>You or your household have ordered this {mine.ordered_count === 1 ? "once" : `${mine.ordered_count} times`}{mine.last_ordered ? `. You last had it ${longDate(mine.last_ordered)}` : ""}.</>
            : <>You&rsquo;ve ordered this {mine.ordered_count === 1 ? "once" : `${mine.ordered_count} times`}{mine.last_ordered ? `, most recently ${longDate(mine.last_ordered)}` : ""}.</>
          : "Not in your order history yet."}
      </p>

      <div>
        <h2 className="pp-t-section mb-3" style={{ color: ACCENTS["yours"].ink }}>Your note</h2>
        {editing || !mine.note ? (
          <div className="mt-2 space-y-2">
            <textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={3} maxLength={2000} className={inputCls}
              placeholder={kind === "cocktail" ? "What did you think? Ask for it differently next time?" : "Nose, palate, how you like it poured…"} aria-label="Your tasting note" />
            <p className="font-body text-[0.875rem]" style={{ color: C.faint }}>{PRIVATE_LINE}</p>
            <div className="flex gap-2">
              <button type="button" className={smallBtn} style={{ borderColor: C.brass, color: C.brass }} disabled={!draft.trim() || draft.trim() === mine.note} onClick={() => saveNote(draft)}>Save note</button>
              {editing && <button type="button" className={smallBtn} style={{ borderColor: C.line, color: C.muted }} onClick={() => { setDraft(mine.note); setEditing(false); }}>Cancel</button>}
            </div>
          </div>
        ) : (
          <div className="mt-2">
            <p className="font-body text-[1rem] leading-relaxed whitespace-pre-line" style={{ color: C.text }}>{mine.note}</p>
            <p className="font-body text-[0.875rem] mt-1" style={{ color: C.faint }}>{PRIVATE_LINE}</p>
            <div className="flex gap-3 mt-2 font-body text-[0.875rem]">
              <button type="button" className="underline" style={{ color: C.muted }} onClick={() => { setDraft(mine.note); setEditing(true); }}>Edit</button>
              <button type="button" className="underline" style={{ color: C.muted }} onClick={() => { if (confirm("Delete this note?")) { setDraft(""); saveNote(""); } }}>Delete</button>
              {saved && <span style={{ color: C.faint }}>Saved.</span>}
            </div>
          </div>
        )}
      </div>
      {error && <Notice>{error}</Notice>}
    </section>
  );
}

/** Remove one of the member's own records (favorite, rating or note), even one that no longer opens. */
export function RemoveRecord({ what, refId, label = "Remove" }: { what: "favorite" | "rating" | "note"; refId: number; label?: string }) {
  const { run, error, router } = useAct();
  const [busy, setBusy] = useState(false);
  return (
    <span className="inline-flex flex-col items-end">
      <button type="button" disabled={busy} className="font-body text-[0.875rem] underline whitespace-nowrap" style={{ color: C.faint }} onClick={async () => {
        setBusy(true);
        const ok = await run(`/api/passport/${what}`, { ref: refId }, "DELETE");
        setBusy(false);
        if (ok) { if (what !== "note") notifyChanged("marks"); router.refresh(); }
      }}>{busy ? "…" : label}</button>
      {error && <span className="font-body text-[0.875rem]" style={{ color: "#f0c4b2" }}>{error}</span>}
    </span>
  );
}

/** An item in the member's records: a link when it still opens, otherwise its name only. */
export function ItemLine({ kind, id, name, label, opens, children, aside }: { kind: ItemKind; id: number | null; name: string; label: string | null; opens: boolean; children?: ReactNode; aside?: ReactNode }) {
  const href = opens ? itemHref(kind, id) : null;
  const title = <span className={kind === "cocktail" ? "font-display text-[1.25rem] leading-tight" : "font-body text-[1rem]"} style={{ color: href ? C.text : C.muted }}>{name}</span>;
  return (
    <li className="py-3 border-b flex items-start gap-3" style={{ borderColor: C.line }}>
      <div className="flex-1 min-w-0">
        {href ? <Link href={href} scroll={false}>{title}</Link> : title}
        {label && <span className="ml-2 font-body text-[0.75rem] tracking-[0.15em] uppercase whitespace-nowrap" style={{ color: C.faint }}>{label}</span>}
        {children}
      </div>
      {aside}
    </li>
  );
}

// ── Lists and top 10s ────────────────────────────────────────────────────────
export function ListsManager({ initial }: { initial: PassportList[] }) {
  const { run, error } = useAct();
  const [lists, setLists] = useState(initial);
  const [making, setMaking] = useState(false);
  const [name, setName] = useState("");
  const [kind, setKind] = useState<ItemKind>("cocktail");
  const [ranked, setRanked] = useState(false);
  const router = useRouter();
  const move = async (i: number, d: number) => {
    const j = i + d;
    if (j < 0 || j >= lists.length) return;
    const next = arrayMove(lists, i, j);
    const before = lists;
    setLists(next);
    const out = await run<{ lists: PassportList[] }>("/api/passport/lists", { ids: next.map((l) => l.id) }, "PUT");
    if (!out) setLists(before); else notifyChanged("lists");
  };
  const create = async () => {
    const out = await run<{ list: PassportList }>("/api/passport/lists", { name, kind, ranked }, "POST");
    if (out) { notifyChanged("lists"); router.push(`/passport/lists/${out.list.id}`, { scroll: false }); }
  };
  return (
    <div>
      {lists.length ? (
        <ul>
          {lists.map((l, i) => (
            <li key={l.id} className="flex items-center gap-2 py-3 border-b" style={{ borderColor: C.line }}>
              <span className="block w-14 h-14 shrink-0 rounded-md overflow-hidden"><Collage covers={listCovers(l)} section="yours" label={l.name} /></span>
              <Link href={`/passport/lists/${l.id}`} scroll={false} className="flex-1 min-w-0 pp-focus rounded-sm">
                <span className="font-display text-[1.25rem] leading-tight block truncate" style={{ color: C.text }}>{l.name}</span>
                <span className="font-body text-[0.75rem] tracking-[0.12em] uppercase" style={{ color: C.faint }}>
                  {l.ranked ? "Top 10" : "Playlist"} · {l.count} {l.kind === "cocktail" ? "cocktail" : "bottle"}{l.count === 1 ? "" : "s"}
                </span>
              </Link>
              <MoveButtons label={l.name} first={i === 0} last={i === lists.length - 1} onMove={(d) => move(i, d)} />
            </li>
          ))}
        </ul>
      ) : (
        <p className="font-body text-sm" style={{ color: C.faint }}>No lists yet. Make a playlist of favorites, or rank your top 10 rums.</p>
      )}
      {making ? (
        <div className="mt-4 rounded-xl border p-4 space-y-3" style={{ borderColor: C.line, background: C.card }}>
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} placeholder="Name, e.g. Top 10 rums" className={inputCls} aria-label="List name" autoFocus />
          <Choice options={[["cocktail", "Cocktails"], ["bottle", "Bottles"]]} value={kind} onChange={(v) => setKind(v as ItemKind)} label="What it holds" />
          <Choice options={[["playlist", "Playlist"], ["top", "Top 10"]]} value={ranked ? "top" : "playlist"} onChange={(v) => setRanked(v === "top")} label="Kind of list" />
          <p className="font-body text-[0.875rem]" style={{ color: C.faint }}>{ranked ? "Ranked, up to ten. Drag or use the arrows to order it." : "Unranked, as long as you like."} Lists are private.</p>
          <div className="flex gap-2">
            <button type="button" className={smallBtn} style={{ borderColor: C.brass, color: C.brass }} disabled={!name.trim()} onClick={create}>Make list</button>
            <button type="button" className={smallBtn} style={{ borderColor: C.line, color: C.muted }} onClick={() => setMaking(false)}>Cancel</button>
          </div>
        </div>
      ) : (
        <button type="button" className="mt-2 min-h-[44px] font-body text-sm underline underline-offset-4 pp-focus" style={{ color: C.text }} onClick={() => setMaking(true)}>+ New list</button>
      )}
      {error && <div className="mt-3"><Notice>{error}</Notice></div>}
    </div>
  );
}

function Choice({ options, value, onChange, label }: { options: [string, string][]; value: string; onChange: (v: string) => void; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="flex gap-2">
      {options.map(([v, l]) => (
        <button key={v} type="button" role="radio" aria-checked={value === v} onClick={() => onChange(v)} className={smallBtn}
          style={value === v ? { borderColor: C.brass, color: C.brass, background: "#1a1f14" } : { borderColor: C.line, color: C.muted }}>{l}</button>
      ))}
    </div>
  );
}

function MoveButtons({ label, first, last, onMove }: { label: string; first: boolean; last: boolean; onMove: (d: number) => void }) {
  const cls = "w-10 h-10 rounded-full border flex items-center justify-center disabled:opacity-25";
  return (
    <span className="flex gap-1 shrink-0">
      <button type="button" className={cls} style={{ borderColor: C.line, color: C.muted }} disabled={first} onClick={() => onMove(-1)} aria-label={`Move ${label} up`}>↑</button>
      <button type="button" className={cls} style={{ borderColor: C.line, color: C.muted }} disabled={last} onClick={() => onMove(1)} aria-label={`Move ${label} down`}>↓</button>
    </span>
  );
}

/** One list: drag to reorder (or the arrow buttons, for touch and keyboard), add by searching, rename, delete. */
export function ListEditor({ initial }: { initial: PassportList }) {
  const { run, error } = useAct();
  const router = useRouter();
  const [list, setList] = useState(initial);
  const [items, setItems] = useState<ListItem[]>(initial.items || []);
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(initial.name);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const full = list.cap !== null && items.length >= list.cap;
  const apply = (l: PassportList | undefined) => { if (l) { setList(l); setItems(l.items || []); notifyChanged("lists"); } };
  const reorder = async (next: ListItem[]) => {
    const before = items;
    setItems(next.map((x, i) => ({ ...x, position: i + 1 })));
    const out = await run<{ list: PassportList }>(`/api/passport/lists/${list.id}`, { refs: next.map((x) => x.ref) }, "PUT");
    if (!out) setItems(before); else apply(out.list);
  };
  const onDragEnd = (e: DragEndEvent) => {
    if (!e.over || e.active.id === e.over.id) return;
    const from = items.findIndex((x) => x.ref === e.active.id);
    const to = items.findIndex((x) => x.ref === e.over!.id);
    if (from >= 0 && to >= 0) reorder(arrayMove(items, from, to));
  };
  const remove = async (ref: number) => {
    const out = await run<{ list: PassportList }>(`/api/passport/lists/${list.id}/items`, { ref }, "DELETE");
    if (out) apply(out.list);
  };
  const add = async (p: Pick) => {
    const out = await run<{ list: PassportList }>(`/api/passport/lists/${list.id}/items`, { id: p.id }, "POST");
    if (out) apply(out.list);
  };
  const rename = async () => {
    const out = await run<{ list: PassportList }>(`/api/passport/lists/${list.id}`, { name }, "PUT");
    if (out) { apply(out.list); setRenaming(false); }
  };
  const del = async () => {
    if (!confirm(`Delete “${list.name}”? This can't be undone.`)) return;
    const out = await run(`/api/passport/lists/${list.id}`, {}, "DELETE");
    if (out) { notifyChanged("lists"); router.push("/passport/library", { scroll: false }); }
  };
  return (
    <div>
      <BackLink fallback="/passport/library?at=lists" label="Lists" />
      <p className="font-body text-[0.75rem] tracking-[0.3em] uppercase mt-3" style={{ color: C.brass }}>
        {list.ranked ? "Top 10" : "Playlist"} · {list.kind === "cocktail" ? "Cocktails" : "Bottles"}
      </p>
      {renaming ? (
        <div className="mt-2 flex gap-2">
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} className={inputCls} aria-label="List name" autoFocus />
          <button type="button" className={smallBtn} style={{ borderColor: C.brass, color: C.brass }} disabled={!name.trim()} onClick={rename}>Save</button>
        </div>
      ) : (
        <h1 className="font-display text-4xl mt-1" style={{ color: C.text }}>{list.name}</h1>
      )}
      <div className="flex gap-4 mt-2 font-body text-[0.875rem]">
        {!renaming && <button type="button" className="underline" style={{ color: C.muted }} onClick={() => setRenaming(true)}>Rename</button>}
        <button type="button" className="underline" style={{ color: C.muted }} onClick={del}>Delete list</button>
        {/* File 09: friends get a copy they can save (names and order only; never your stars or notes). */}
        {items.length > 0 && <ShareButton kind="list" id={list.id} name={list.name} compact />}
      </div>
      {error && <div className="mt-4"><Notice>{error}</Notice></div>}

      <div className="mt-6">
        {items.length ? (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            <SortableContext items={items.map((x) => x.ref)} strategy={verticalListSortingStrategy}>
              <ol>
                {items.map((it, i) => (
                  <SortableRow key={it.ref} it={it} index={i} ranked={list.ranked} first={i === 0} last={i === items.length - 1}
                    onMove={(d) => reorder(arrayMove(items, i, i + d))} onRemove={() => remove(it.ref)} />
                ))}
              </ol>
            </SortableContext>
          </DndContext>
        ) : (
          <p className="font-body text-sm" style={{ color: C.faint }}>Nothing on this list yet. Search below to add {list.kind === "cocktail" ? "cocktails from the Library" : "bottles from the spirits list and archive"}.</p>
        )}
        {items.length > 1 && <p className="font-body text-[0.875rem] mt-3" style={{ color: C.faint }}>Drag the handle, or use the arrows, to change the order.</p>}
      </div>

      <div className="mt-8">
        <h2 className="pp-t-section mb-3" style={{ color: ACCENTS["yours"].ink }}>Add {list.kind === "cocktail" ? "a cocktail" : "a bottle"}</h2>
        {full ? <p className="font-body text-sm mt-2" style={{ color: C.faint }}>A top 10 holds ten. Remove one to add another.</p>
          : <ListSearch kind={list.kind} have={new Set(items.map((x) => x.id).filter((x): x is number => x !== null))} onAdd={add} />}
      </div>
    </div>
  );
}

function SortableRow({ it, index, ranked, first, last, onMove, onRemove }: { it: ListItem; index: number; ranked: boolean; first: boolean; last: boolean; onMove: (d: number) => void; onRemove: () => void }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: it.ref });
  const href = it.opens ? itemHref(it.kind, it.id) : null;
  const name = <span className={it.kind === "cocktail" ? "font-display text-[1.1875rem] leading-tight" : "font-body text-[1rem]"} style={{ color: href ? C.text : C.muted }}>{it.name}</span>;
  return (
    <li ref={setNodeRef} className="flex items-center gap-2 py-2.5 border-b" style={{ borderColor: C.line, transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.6 : 1, background: isDragging ? C.card : undefined }}>
      <button type="button" ref={setActivatorNodeRef} {...attributes} {...listeners} aria-label={`Drag to move ${it.name}`} className="w-8 h-10 flex items-center justify-center touch-none cursor-grab shrink-0" style={{ color: C.faint }}>
        <svg width="14" height="18" viewBox="0 0 14 18" fill="currentColor" aria-hidden><circle cx="4" cy="4" r="1.5" /><circle cx="10" cy="4" r="1.5" /><circle cx="4" cy="9" r="1.5" /><circle cx="10" cy="9" r="1.5" /><circle cx="4" cy="14" r="1.5" /><circle cx="10" cy="14" r="1.5" /></svg>
      </button>
      {ranked && <span className="font-display text-xl w-7 text-right shrink-0" style={{ color: C.brass }}>{index + 1}</span>}
      <div className="flex-1 min-w-0">
        {href ? <Link href={href} scroll={false}>{name}</Link> : name}
        {it.label && <span className="ml-2 font-body text-[0.75rem] tracking-[0.15em] uppercase whitespace-nowrap" style={{ color: C.faint }}>{it.label}</span>}
      </div>
      <MoveButtons label={it.name} first={first} last={last} onMove={onMove} />
      <button type="button" onClick={onRemove} aria-label={`Remove ${it.name}`} className="w-9 h-10 flex items-center justify-center shrink-0" style={{ color: C.faint }}>✕</button>
    </li>
  );
}

function ListSearch({ kind, have, onAdd }: { kind: ItemKind; have: Set<number>; onAdd: (p: Pick) => void }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Pick[] | null>(null);
  const [error, setError] = useState("");
  const seq = useRef(0);
  useEffect(() => {
    const n = ++seq.current;
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/passport/search?${new URLSearchParams({ kind, q: q.trim() }).toString()}`, { cache: "no-store" });
        const data = await res.json().catch(() => ({}));
        if (n !== seq.current) return;
        if (!res.ok) { setError(data.error || OFFLINE); return; }
        setError("");
        setResults(data.results || []);
      } catch {
        if (n === seq.current) setError("You seem to be offline.");
      }
    }, 250);
    return () => clearTimeout(t);
  }, [q, kind]);
  return (
    <div className="mt-2">
      <input value={q} onChange={(e) => setQ(e.target.value)} type="search" className={inputCls} aria-label={kind === "cocktail" ? "Search the Library" : "Search the spirits"}
        placeholder={kind === "cocktail" ? "Search the Library by name or ingredient" : "Search bottles by name or producer"} />
      {error && <p className="font-body text-[0.875rem] mt-2" style={{ color: "#f0c4b2" }}>{error}</p>}
      {results && (
        <ul className="mt-2">
          {results.map((p) => (
            <li key={p.id} className="flex items-center gap-3 py-2.5 border-b" style={{ borderColor: C.line }}>
              <span className="flex-1 min-w-0 font-body text-[1rem]" style={{ color: C.text }}>
                {p.name}{p.label && <span className="ml-2 text-[0.75rem] tracking-[0.15em] uppercase" style={{ color: C.faint }}>{p.label}</span>}
              </span>
              {have.has(p.id)
                ? <span className="font-body text-[0.875rem]" style={{ color: C.faint }}>On the list</span>
                : <button type="button" className={smallBtn} style={{ borderColor: C.brass, color: C.brass }} onClick={() => onAdd(p)}>Add</button>}
            </li>
          ))}
          {!results.length && <li className="font-body text-sm py-2" style={{ color: C.faint }}>Nothing matches that.</li>}
        </ul>
      )}
    </div>
  );
}

// ── Bespoke recipes ──────────────────────────────────────────────────────────
const blankLine = (): BespokeLine => ({ quantity: "", unit: "oz", name: "", sub_recipe: "" });

export function BespokeBook({ initial, units, startNew = false }: { initial: Bespoke[]; units: string[]; startNew?: boolean }) {
  const { run, error } = useAct();
  const [recipes, setRecipes] = useState(initial);
  const [editing, setEditing] = useState<Bespoke | "new" | null>(startNew ? "new" : null);
  const remove = async (r: Bespoke) => {
    if (!confirm(r.by_staff ? `Remove “${r.name}” from your book? Only the bar can add it back.` : `Delete “${r.name}”?`)) return;
    const out = await run(`/api/passport/bespoke/${r.id}`, {}, "DELETE");
    if (out) setRecipes((x) => x.filter((y) => y.id !== r.id));
  };
  return (
    <div>
      {editing ? (
        <RecipeForm recipe={editing === "new" ? null : editing} units={units} onCancel={() => setEditing(null)}
          onSaved={(r) => { setRecipes((x) => [r, ...x.filter((y) => y.id !== r.id)]); setEditing(null); }} />
      ) : (
        <button type="button" className="font-body text-sm underline underline-offset-4" style={{ color: C.text }} onClick={() => setEditing("new")}>+ Add a cocktail</button>
      )}
      {error && <div className="mt-3"><Notice>{error}</Notice></div>}
      <ul className="mt-6 space-y-4">
        {recipes.map((r) => (
          <li key={r.id} className="rounded-xl border p-5" style={{ borderColor: r.by_staff ? `${C.brass}66` : C.line, background: C.card }}>
            <div className="flex items-baseline justify-between gap-3">
              <h3 className="font-display text-2xl" style={{ color: C.text }}>{r.name}</h3>
              <span className="flex gap-3 font-body text-[0.875rem] shrink-0">
                {!r.by_staff && <button type="button" className="underline" style={{ color: C.muted }} onClick={() => setEditing(r)}>Edit</button>}
                <button type="button" className="underline" style={{ color: C.muted }} onClick={() => remove(r)}>{r.by_staff ? "Remove" : "Delete"}</button>
              </span>
            </div>
            {r.by_staff && <p className="font-body text-[0.75rem] tracking-[0.15em] uppercase mt-1" style={{ color: C.brass }}>Made for you by {r.made_by} at Common Good</p>}
            <ul className="mt-3 space-y-1.5">
              {r.lines.map((l, i) => (
                <li key={i} className="font-body text-[1rem]" style={{ color: C.text }}>
                  {(l.quantity || l.unit) && <span style={{ color: C.brass }}>{[l.quantity, l.unit].filter(Boolean).join(" ")} </span>}{l.name}
                  {l.sub_recipe && <span className="block text-sm mt-0.5 ml-4 whitespace-pre-line" style={{ color: C.muted }}>{l.sub_recipe}</span>}
                </li>
              ))}
            </ul>
            {r.notes && <p className="font-body text-sm mt-3 leading-relaxed whitespace-pre-line" style={{ color: C.muted }}>{r.notes}</p>}
            {/* File 09: a recipe the member wrote, or one staff made for them ("Made for you by …" travels with it). */}
            <div className="mt-3"><ShareButton kind="recipe" id={r.id} name={r.name} compact /></div>
          </li>
        ))}
      </ul>
      {!recipes.length && !editing && <p className="font-body text-sm mt-2" style={{ color: C.faint }}>No cocktails here yet. The ones made for you at the bar land here, and you can add your own from home.</p>}
    </div>
  );
}

function RecipeForm({ recipe, units, onCancel, onSaved }: { recipe: Bespoke | null; units: string[]; onCancel: () => void; onSaved: (r: Bespoke) => void }) {
  const { run, error } = useAct();
  const [name, setName] = useState(recipe?.name || "");
  const [notes, setNotes] = useState(recipe?.notes || "");
  const [lines, setLines] = useState<BespokeLine[]>(recipe?.lines.length ? recipe.lines.map((l) => ({ ...l })) : [blankLine(), blankLine(), blankLine()]);
  const [sub, setSub] = useState<Record<number, boolean>>(() => Object.fromEntries((recipe?.lines || []).map((l, i) => [i, !!l.sub_recipe])));
  const [busy, setBusy] = useState(false);
  const set = (i: number, patch: Partial<BespokeLine>) => setLines((ls) => ls.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  const save = async () => {
    setBusy(true);
    const body = { name, notes, lines: lines.filter((l) => l.name.trim() || l.quantity.trim() || l.sub_recipe.trim()) };
    const out = recipe ? await run<{ recipe: Bespoke }>(`/api/passport/bespoke/${recipe.id}`, body, "PUT") : await run<{ recipe: Bespoke }>("/api/passport/bespoke", body, "POST");
    setBusy(false);
    if (out) onSaved(out.recipe);
  };
  const field = "rounded-lg px-3 py-2.5 font-body text-[1rem] bg-[#0E120B] border border-[#323B29] text-[#EDE6D3] placeholder:text-[#5d6a52] focus:outline-none focus:border-[#C9A96E]";
  return (
    <div className="rounded-xl border p-4 space-y-4" style={{ borderColor: C.line, background: C.card }}>
      <input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} placeholder="Cocktail name" className={inputCls} aria-label="Cocktail name" />
      <div>
        <p className="font-body text-[0.75rem] tracking-[0.2em] uppercase mb-2" style={{ color: C.muted }}>Ingredients</p>
        <ul className="space-y-3">
          {lines.map((l, i) => (
            <li key={i} className="space-y-1.5">
              <div className="flex gap-1.5">
                <input value={l.quantity} onChange={(e) => set(i, { quantity: e.target.value })} placeholder="1 1/2" inputMode="decimal" maxLength={12} aria-label="Quantity" className={`${field} w-16`} />
                <select value={l.unit} onChange={(e) => set(i, { unit: e.target.value })} aria-label="Unit" className={`${field} w-24`}>
                  <option value="">—</option>
                  {units.map((u) => <option key={u} value={u}>{u}</option>)}
                </select>
                <input value={l.name} onChange={(e) => set(i, { name: e.target.value })} placeholder="Ingredient" maxLength={80} aria-label="Ingredient" className={`${field} flex-1 min-w-0`} />
                <button type="button" aria-label="Remove line" className="px-1" style={{ color: C.faint }} onClick={() => setLines((ls) => ls.filter((_, j) => j !== i))}>✕</button>
              </div>
              {sub[i]
                ? <textarea value={l.sub_recipe} onChange={(e) => set(i, { sub_recipe: e.target.value })} rows={2} maxLength={1000} className={`${field} w-full`} placeholder="Sub-recipe, e.g. house syrup: 1:1 demerara, stirred" aria-label="Sub-recipe" />
                : <button type="button" className="font-body text-[0.875rem] underline" style={{ color: C.faint }} onClick={() => setSub((s) => ({ ...s, [i]: true }))}>+ sub-recipe</button>}
            </li>
          ))}
        </ul>
        <button type="button" className="font-body text-sm underline mt-3" style={{ color: C.muted }} onClick={() => setLines((ls) => [...ls, blankLine()])}>+ Add a line</button>
      </div>
      <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} maxLength={2000} className={inputCls} placeholder="Notes (optional): glass, garnish, who made it for you" aria-label="Notes" />
      <p className="font-body text-[0.875rem]" style={{ color: C.faint }}>{PRIVATE_LINE}</p>
      {error && <Notice>{error}</Notice>}
      <div className="flex gap-2">
        <button type="button" className={smallBtn} style={{ borderColor: C.brass, color: C.brass }} disabled={busy || !name.trim()} onClick={save}>{busy ? "Saving…" : recipe ? "Save" : "Add cocktail"}</button>
        <button type="button" className={smallBtn} style={{ borderColor: C.line, color: C.muted }} onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}
