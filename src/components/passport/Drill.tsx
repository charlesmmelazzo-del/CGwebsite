"use client";
/* eslint-disable @next/next/no-img-element -- Passport photos come through the member's own signed-in route, never the image optimizer. */

import Link from "next/link";
import { useLayoutEffect, useRef, type CSSProperties, type ReactNode } from "react";
import { C } from "./theme";
import { Avail, ItemRow } from "./bits";
import { MarkBadge, Prices } from "./Library";
import { reducedMotion } from "./appEvents";
import { ACCENTS, type SectionId } from "@/lib/passport/accents";
import { monogram, shortLine, type Cover, type Crumb, type Tile } from "@/lib/passport/nav";
import { barPhotoSrc, markKey, type IndexBottle, type IndexCocktail, type Mark, type Marks, type MenuItem } from "@/lib/passport/types";

/**
 * File 14: the pieces every drill-down screen is made of (Menu and Index): tiles with a cover photo or a quiet
 * monogram, the "where you are" trail, compact rows, section headings in the type scale, and the slide from one
 * level to the next. Photos load lazily at thumbnail size with the item's name as alt text, in boxes of a fixed
 * shape, so nothing moves as they arrive.
 */

// ── Section icons (Part 7: never colour alone; every accented card also has a word and one of these) ─────────
const ICON_PATHS: Record<SectionId, ReactNode> = {
  cocktails: <><path d="M6.5 4h11l-5.5 7.5z" /><path d="M12 11.5V19M8.5 20h7" /></>,
  spirits: <><path d="M10 3h4v4l1.5 2v11a1 1 0 0 1-1 1h-5a1 1 0 0 1-1-1V9L10 7z" /><path d="M8.5 13h7" /></>,
  "beer-wine": <><path d="M8 3h8l-.5 6a3.5 3.5 0 0 1-7 0z" /><path d="M12 12.5V20M9 20.5h6" /></>,
  events: <><rect x="4" y="5.5" width="16" height="14.5" rx="1.5" /><path d="M4 10h16M8.5 3.5v4M15.5 3.5v4" /></>,
  inbox: <><path d="M4 13.5 6.5 5h11l2.5 8.5V19H4z" /><path d="M4 13.5h4.5l1.2 2h4.6l1.2-2H20" /></>,
  friends: <><circle cx="9" cy="9" r="3" /><circle cx="16.5" cy="10" r="2.4" /><path d="M3.5 19c.8-3 3-4.5 5.5-4.5s4.7 1.5 5.5 4.5M14.5 15c2.6-.5 4.8.8 5.6 3.5" /></>,
  bar: <><path d="M5 20V9l7-5 7 5v11" /><path d="M9.5 20v-5h5v5" /></>,
  yours: <><path d="M12 20s-7-4.4-7-9.5A3.8 3.8 0 0 1 12 8a3.8 3.8 0 0 1 7 2.5C19 15.6 12 20 12 20z" /></>,
};
export function SectionIcon({ section, size = 14, color }: { section: SectionId; size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color || ACCENTS[section].ink} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="shrink-0">
      {ICON_PATHS[section]}
    </svg>
  );
}
/** A card's kind: the section's icon and a small-caps word in its colour. */
export function KindLabel({ section, children }: { section: SectionId; children: ReactNode }) {
  return (
    <span className="pp-t-eyebrow flex items-center gap-1.5" style={{ color: ACCENTS[section].ink }}>
      <SectionIcon section={section} size={13} />{children}
    </span>
  );
}
/** A card in its section's colours: tinted background, coloured left edge. */
export function accentCardStyle(section: SectionId): CSSProperties {
  const a = ACCENTS[section];
  return { background: a.tint, borderColor: `${a.edge}55`, borderLeftColor: a.edge };
}

/** Part 8: a section heading: the display serif, larger than body, in its section's colour (h2 unless told). */
export function SectionHeading({ children, section, id, as = "h2", aside, className = "" }: { children: ReactNode; section?: SectionId | null; id?: string; as?: "h2" | "h3"; aside?: ReactNode; className?: string }) {
  const H = as;
  return (
    <div className={`flex items-baseline justify-between gap-3 ${className}`}>
      <H id={id} className="pp-t-section" style={{ color: section ? ACCENTS[section].ink : C.text }}>{children}</H>
      {aside}
    </div>
  );
}

// ── Covers and tiles ─────────────────────────────────────────────────────────
/** A cover photo (thumbnail size, lazy, alt = the item's name), or a brass-on-dark monogram in the section's tint. */
export function CoverArt({ cover, label, section, className = "", eager = false, size = "thumb" }: { cover: Cover | null; label: string; section: SectionId | null; className?: string; eager?: boolean; size?: "thumb" | "full" }) {
  if (cover) {
    return (
      <img src={barPhotoSrc(cover.kind, cover.id, cover.photo, size)} alt={cover.name} loading={eager ? "eager" : "lazy"} decoding="async"
        className={`w-full h-full object-cover ${className}`} style={{ background: C.card }} />
    );
  }
  const a = section ? ACCENTS[section] : null;
  return (
    <span aria-hidden className={`w-full h-full flex items-center justify-center ${className}`}
      style={{ background: a ? `radial-gradient(circle at 30% 25%, ${a.tint}, ${C.bg} 85%)` : `radial-gradient(circle at 30% 25%, #1f2619, ${C.bg} 85%)` }}>
      <span className="font-display leading-none" style={{ fontSize: "2.1rem", color: C.brass, opacity: 0.85, letterSpacing: "0.02em" }}>{monogram(label)}</span>
    </span>
  );
}

export function TileGrid({ tiles, onPick, big = false }: { tiles: Tile[]; onPick?: () => void; big?: boolean }) {
  return (
    <ul className={`grid gap-3 ${big ? "grid-cols-2" : "grid-cols-2 sm:grid-cols-3"}`}>
      {tiles.map((t, i) => (
        <li key={t.id}>
          <TileLink t={t} onPick={onPick} eager={i < 4} />
        </li>
      ))}
    </ul>
  );
}
function TileLink({ t, onPick, eager }: { t: Tile; onPick?: () => void; eager?: boolean }) {
  const a = ACCENTS[t.section];
  return (
    <Link href={t.href} scroll={false} onClick={onPick} className="block h-full rounded-xl overflow-hidden border pp-focus pp-row pp-card"
      style={{ borderColor: `${a.edge}40` }}>
      <span className="block relative aspect-[4/3] overflow-hidden">
        <CoverArt cover={t.cover} label={t.label} section={t.section} eager={eager} />
        {t.cover && <span aria-hidden className="absolute inset-0" style={{ background: "linear-gradient(180deg, rgba(19,23,15,0) 45%, rgba(19,23,15,0.55) 100%)" }} />}
      </span>
      <span className="block px-3 pt-2.5 pb-3 border-t-2" style={{ borderTopColor: a.edge, background: a.tint }}>
        <span className="flex items-baseline justify-between gap-2">
          <span className="pp-t-card block min-w-0" style={{ color: C.text, overflowWrap: "anywhere" }}>{t.label}</span>
          {t.count !== undefined && t.count > 0 && <span className="pp-t-secondary pp-num shrink-0" style={{ color: a.ink }}>{t.count}</span>}
        </span>
        {t.line && <span className="pp-t-secondary block mt-0.5" style={{ color: C.muted }}>{t.line}</span>}
      </span>
    </Link>
  );
}

/** A wide cover across the top of a Menu tab, with the tab's name over it. */
export function CoverBanner({ cover, title, section }: { cover: Cover | null; title: string; section: SectionId }) {
  if (!cover) return null;
  return (
    <figure className="relative -mx-5 sm:mx-0 mt-4 aspect-[16/7] overflow-hidden sm:rounded-xl" style={{ background: C.card }}>
      <CoverArt cover={cover} label={title} section={section} eager size="full" />
      <span aria-hidden className="absolute inset-0" style={{ background: "linear-gradient(180deg, rgba(19,23,15,0) 35%, rgba(19,23,15,0.88) 100%)" }} />
      <figcaption className="absolute left-5 right-5 bottom-3 pp-t-section !m-0" style={{ color: C.text, textShadow: "0 1px 12px rgba(0,0,0,0.6)" }}>{title}</figcaption>
    </figure>
  );
}

// ── Where you are ────────────────────────────────────────────────────────────
/**
 * "Index › Cocktails › By spirit › Mezcal": every step but the last opens that level. On a phone a long trail keeps
 * its first and last two steps and folds the middle into "…" (still a link to the step before the last two).
 */
export function Trail({ trail, title, onPick }: { trail: Crumb[]; title: string; onPick?: () => void }) {
  if (trail.length <= 1) return null;
  const steps = trail.slice(0, -1);
  const folded = steps.length > 3 ? [steps[0], { label: "…", href: steps[steps.length - 3].href }, ...steps.slice(-2)] : steps;
  return (
    <nav aria-label="Where you are" className="sticky z-20 -mx-5 px-5 py-2 border-b" style={{ top: "var(--pp-top)", background: "rgba(19,23,15,0.97)", borderColor: C.line }}>
      <ol className="flex items-center gap-1 min-w-0 whitespace-nowrap overflow-hidden">
        {folded.map((c, i) => (
          <li key={`${c.href}-${i}`} className="flex items-center gap-1 min-w-0 shrink">
            <Link href={c.href} scroll={false} onClick={onPick} className="pp-t-secondary pp-focus rounded min-h-[44px] inline-flex items-center px-1 truncate max-w-[9rem] underline-offset-4 hover:underline" style={{ color: C.muted }}>
              {i === 0 && <span aria-hidden className="mr-1">‹</span>}{c.label}
            </Link>
            <span aria-hidden style={{ color: C.faint }}>›</span>
          </li>
        ))}
        <li aria-current="page" className="pp-t-secondary truncate min-w-0 px-1" style={{ color: C.text }}>{title}</li>
      </ol>
    </nav>
  );
}

/** The slide from one level to the next (forward from the right, back from the left); nothing with reduce motion. */
export function useLevelMotion(key: string, depth: number) {
  const ref = useRef<HTMLDivElement>(null);
  const last = useRef<{ key: string; depth: number } | null>(null);
  useLayoutEffect(() => {
    const was = last.current;
    last.current = { key, depth };
    const el = ref.current;
    if (!was || was.key === key || !el || reducedMotion()) return;
    el.classList.remove("pp-level-in", "pp-level-back");
    void el.offsetWidth;
    el.classList.add(depth >= was.depth ? "pp-level-in" : "pp-level-back");
  }, [key, depth]);
  return ref;
}

// ── Compact rows ─────────────────────────────────────────────────────────────
function RowThumb({ kind, id, photo, name }: { kind: "cocktail" | "bottle"; id: number | null; photo?: string | null; name: string }) {
  if (!photo || !id) return null;
  return <img src={barPhotoSrc(kind, id, photo, "thumb")} alt={name} loading="lazy" decoding="async" width={44} height={44} className="shrink-0 rounded-md object-cover" style={{ width: 44, height: 44, background: C.card }} />;
}
const oneLine: CSSProperties = { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" };

/** A cocktail in a final list: name, the flavor line on one line, the green dot, marks, thumbnail and "+". */
export function CompactCocktail({ c, mark }: { c: IndexCocktail; mark?: Mark }) {
  return (
    <ItemRow item={{ kind: "cocktail", id: c.id, name: c.name }} href={`/passport/library/${c.id}`} pad="py-2.5" lazy>
      <span className="flex items-center gap-3 min-h-[44px]">
        <span className="flex-1 min-w-0">
          <span className="flex items-center gap-2 min-w-0">
            <span className="pp-t-card min-w-0" style={{ color: C.text, ...oneLine }}>{c.name}</span>
            <Avail on={c.available} /><MarkBadge mark={mark} />
          </span>
          {(c.flavor || c.menu_name) && <span className="pp-t-secondary block" style={{ color: C.muted, ...oneLine }}>{c.flavor || c.menu_name}</span>}
        </span>
        <RowThumb kind="cocktail" id={c.id} photo={c.photo} name={c.name} />
      </span>
    </ItemRow>
  );
}
/** A bottle in a final list: name, its label, the dot, thumbnail and "+"; "out right now" dimmed. */
export function CompactBottle({ b, out, mark, prices }: { b: Pick<IndexBottle, "id" | "name" | "photo" | "available" | "status_label">; out: boolean; mark?: Mark; prices?: MenuItem["prices"] }) {
  return (
    <ItemRow item={{ kind: "bottle", id: b.id, name: b.name }} href={`/passport/spirits/${b.id}`} pad="py-2.5" lazy>
      <span className="flex items-center gap-3 min-h-[44px]" style={{ opacity: out ? 0.6 : 1 }}>
        <span className="flex-1 min-w-0">
          <span className="flex items-center gap-2 min-w-0">
            <span className="pp-t-body min-w-0" style={{ color: C.text, ...oneLine }}>{b.name}</span>
            <Avail on={b.available} /><MarkBadge mark={mark} />
          </span>
          {b.status_label && <span className="pp-t-secondary block" style={{ color: C.faint }}>{b.status_label}</span>}
        </span>
        {prices && prices.length > 0 && <span className="pp-num"><Prices prices={prices} /></span>}
        <RowThumb kind="bottle" id={b.id} photo={b.photo} name={b.name} />
      </span>
    </ItemRow>
  );
}
/** A Toast menu item on the Menu tab: name, one short line, price(s), thumbnail and "+". The rest is on its page. */
export function CompactMenuItem({ it, marks, spirit = false }: { it: MenuItem; marks?: Marks; spirit?: boolean }) {
  const href = it.cocktail_id ? `/passport/library/${it.cocktail_id}` : it.bottle_id ? `/passport/spirits/${it.bottle_id}` : null;
  const item = it.cocktail_id ? { kind: "cocktail" as const, id: it.cocktail_id, name: it.name } : it.bottle_id ? { kind: "bottle" as const, id: it.bottle_id, name: it.name } : null;
  const mark = marks && (it.cocktail_id ? marks[markKey("cocktail", it.cocktail_id)] : it.bottle_id ? marks[markKey("bottle", it.bottle_id)] : undefined);
  const line = spirit ? (it.unavailable ? "Out right now" : "") : shortLine(it);
  return (
    <ItemRow item={item} href={href} pad="py-2.5" lazy>
      <span className="flex items-center gap-3 min-h-[44px]" style={{ opacity: it.unavailable ? 0.6 : 1 }}>
        <span className="flex-1 min-w-0">
          <span className="flex items-center gap-2 min-w-0">
            <span className={spirit ? "pp-t-body min-w-0" : "pp-t-card min-w-0"} style={{ color: C.text, ...oneLine }}>{it.name}</span>
            <MarkBadge mark={mark} />
          </span>
          {line && <span className="pp-t-secondary block" style={{ color: it.unavailable ? C.faint : C.muted, ...oneLine }}>{line}</span>}
        </span>
        {it.prices.length > 0 && <span className="pp-num shrink-0"><Prices prices={it.prices} /></span>}
        <RowThumb kind={it.cocktail_id ? "cocktail" : "bottle"} id={it.cocktail_id || it.bottle_id} photo={it.photo} name={it.name} />
      </span>
    </ItemRow>
  );
}
/** A row that opens a further level: a name and how many are inside (producers, letters…). */
export function CountRow({ href, label, count, onPick }: { href: string; label: string; count: number; onPick?: () => void }) {
  return (
    <li className="border-b" style={{ borderColor: C.line, contentVisibility: "auto", containIntrinsicSize: "auto 52px" }}>
      <Link href={href} scroll={false} onClick={onPick} className="flex items-center justify-between gap-3 min-h-[52px] py-2 pp-focus pp-row rounded-sm">
        <span className="pp-t-body min-w-0" style={{ color: C.text, overflowWrap: "anywhere" }}>{label}</span>
        <span className="flex items-center gap-3 shrink-0">
          <span className="pp-t-secondary pp-num" style={{ color: C.faint }}>{count}</span>
          <span aria-hidden style={{ color: C.muted }}>›</span>
        </span>
      </Link>
    </li>
  );
}
