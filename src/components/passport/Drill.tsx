"use client";
/* eslint-disable @next/next/no-img-element -- Passport photos come through the member's own signed-in route, never the image optimizer. */

import Link from "next/link";
import { useLayoutEffect, useRef, type CSSProperties, type ReactNode } from "react";
import { C } from "./theme";
import { Avail, ItemRow } from "./bits";
import { MarkBadge, Prices } from "./Library";
import { reducedMotion } from "./appEvents";
import { ACCENTS, type SectionId } from "@/lib/passport/accents";
import { shortLine, type Banner, type Cover, type Crumb, type Tile } from "@/lib/passport/nav";
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
  // File 16: Messages, a chat bubble (the bottom tab's icon).
  inbox: <><path d="M4.5 6.5A2.5 2.5 0 0 1 7 4h10a2.5 2.5 0 0 1 2.5 2.5v7A2.5 2.5 0 0 1 17 16h-6.5L6 19.5V16H7a2.5 2.5 0 0 1-2.5-2.5z" /><path d="M8.5 9h7M8.5 12h4.5" /></>,
  friends: <><circle cx="9" cy="9" r="3" /><circle cx="16.5" cy="10" r="2.4" /><path d="M3.5 19c.8-3 3-4.5 5.5-4.5s4.7 1.5 5.5 4.5M14.5 15c2.6-.5 4.8.8 5.6 3.5" /></>,
  bar: <><path d="M5 20V9l7-5 7 5v11" /><path d="M9.5 20v-5h5v5" /></>,
  yours: <><path d="M6 4.5h10.5a1.5 1.5 0 0 1 1.5 1.5v14H7.5A1.5 1.5 0 0 1 6 18.5z" /><path d="M6 18.5A1.5 1.5 0 0 1 7.5 17H18M9.5 8.5h5M9.5 11.5h5" /></>,
  // File 15: Party Picks (votes and brackets): a ballot with a tick.
  party: <><rect x="4.5" y="4" width="15" height="16" rx="1.5" /><path d="m8.5 12.5 2.3 2.3 4.7-5" /></>,
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
    <div className={`flex items-baseline justify-between gap-3 mt-10 mb-3 ${className}`}>
      <H id={id} className="pp-t-section" style={{ color: section ? ACCENTS[section].ink : C.text }}>{children}</H>
      {aside}
    </div>
  );
}

// ── Covers and tiles ─────────────────────────────────────────────────────────
/**
 * File 15, Part C: a collection's cover, like a playlist's art: four photos as a 2×2; three as one tall and two small;
 * two side by side; one alone; none, the section's icon large, in its colour on its tint. Photos load lazily at
 * thumbnail size with each item's name as alt text, inside a box of fixed shape (nothing moves as they arrive). A bottle
 * is shown whole (contain-fit) and a photo with a transparent background without a box, both on the section's tint.
 */
export function Collage({ covers, section, label, className = "", eager = false, size = "thumb" }: { covers: Cover[]; section: SectionId | null; label: string; className?: string; eager?: boolean; size?: "thumb" | "full" }) {
  const a = section ? ACCENTS[section] : null;
  const tint = a ? a.tint : C.card;
  const cs = covers.slice(0, 4);
  if (!cs.length) {
    return (
      <span aria-hidden className={`w-full h-full flex items-center justify-center ${className}`} style={{ background: tint }} data-collage="0">
        {section ? <SectionIcon section={section} size={44} /> : <span className="font-display" style={{ color: C.brass, fontSize: "2rem" }}>CG</span>}
      </span>
    );
  }
  const img = (c: Cover, i: number, extra = "") => {
    const fit = c.clear || c.kind === "bottle";
    return (
      <span key={`${c.kind}${c.id}`} className={`block overflow-hidden min-w-0 min-h-0 ${extra}`} style={{ background: tint }}>
        <img src={barPhotoSrc(c.kind, c.id, c.photo, size)} alt={c.name} loading={eager && i === 0 ? "eager" : "lazy"} decoding="async"
          className={`w-full h-full ${fit ? "object-contain" : "object-cover"}`} style={fit ? { padding: c.clear ? "8%" : "4%" } : undefined} />
      </span>
    );
  };
  const grid = cs.length === 4 ? "grid-cols-2 grid-rows-2" : cs.length === 3 ? "grid-cols-2 grid-rows-2" : cs.length === 2 ? "grid-cols-2 grid-rows-1" : "grid-cols-1 grid-rows-1";
  return (
    <span className={`w-full h-full grid gap-px ${grid} ${className}`} style={{ background: C.bg }} data-collage={cs.length} aria-label={`${label}: ${cs.map((c) => c.name).join(", ")}`} role="img">
      {cs.map((c, i) => img(c, i, cs.length === 3 && i === 0 ? "row-span-2" : ""))}
    </span>
  );
}
/** @deprecated file 14: one cover photo; now a collage of one. */
export function CoverArt({ cover, label, section, className = "", eager = false, size = "thumb" }: { cover: Cover | null; label: string; section: SectionId | null; className?: string; eager?: boolean; size?: "thumb" | "full" }) {
  return <Collage covers={cover ? [cover] : []} label={label} section={section} className={className} eager={eager} size={size} />;
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
    <Link href={t.href} scroll={false} onClick={onPick} className="flex flex-col h-full rounded-xl overflow-hidden border pp-focus pp-row pp-card"
      style={{ borderColor: `${a.edge}40` }}>
      <span className="block relative aspect-[4/3] overflow-hidden">
        <Collage covers={t.covers} label={t.label} section={t.section} eager={eager} />
      </span>
      <span className="block flex-1 px-3 pt-2.5 pb-3 border-t-2" style={{ borderTopColor: a.edge, background: a.tint }}>
        <span className="flex flex-wrap items-baseline justify-between gap-x-2">
          <span className="pp-t-card block min-w-0" style={{ color: C.text, overflowWrap: "break-word", hyphens: "auto" }}>{t.label}</span>
          {t.count !== undefined && t.count > 0 && <span className="pp-t-secondary pp-num shrink-0" style={{ color: a.ink }}>{t.count}</span>}
        </span>
        {t.line && <span className="pp-t-secondary block mt-0.5" style={{ color: C.muted }}>{t.line}</span>}
      </span>
    </Link>
  );
}

/**
 * File 15, Part A: the Party Picks banner at the top of the Index, above the tiles: one full-width card about a third of
 * a tile's height, with its name, one line ("Voting is open: 2", "See past votes") and its collage. Not drawn at all
 * when nothing is open and there are no past votes.
 */
export function PartyBanner({ b }: { b: Banner | null | undefined }) {
  if (!b) return null;
  const a = ACCENTS[b.section];
  return (
    <Link href={b.href} scroll={false} className="pp-party-banner flex items-stretch h-[84px] rounded-xl overflow-hidden border mb-4 pp-focus pp-row pp-card"
      style={{ borderColor: `${a.edge}55`, borderLeftWidth: 3, borderLeftColor: a.edge, background: a.tint }}>
      <span className="flex-1 min-w-0 flex flex-col justify-center px-4">
        <KindLabel section={b.section}>Take part</KindLabel>
        <span className="pp-t-card block leading-tight mt-0.5" style={{ color: C.text }}>{b.label}</span>
        <span className="pp-t-secondary block" style={{ color: a.ink }}>{b.line}</span>
      </span>
      <span className="block w-[84px] h-full shrink-0 overflow-hidden"><Collage covers={b.covers} label={b.label} section={b.section} eager /></span>
    </Link>
  );
}

/** A wide cover across the top of a Menu tab, with the tab's name over it. */
export function CoverBanner({ cover, title, section }: { cover: Cover | null; title: string; section: SectionId }) {
  if (!cover) return null;
  return (
    <figure className="relative -mx-5 sm:mx-0 mt-4 aspect-[16/7] overflow-hidden sm:rounded-xl" style={{ background: ACCENTS[section].tint }}>
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
function RowThumb({ kind, id, photo, name, clear }: { kind: "cocktail" | "bottle"; id: number | null; photo?: string | null; name: string; clear?: boolean }) {
  if (!photo || !id) return null;
  // File 15: a bottle (portrait) is shown whole; a cut-out photo without a box; both on the app's dark tint.
  const fit = clear || kind === "bottle";
  return <img src={barPhotoSrc(kind, id, photo, "thumb")} alt={name} loading="lazy" decoding="async" width={44} height={44}
    className={`shrink-0 rounded-md ${fit ? "object-contain" : "object-cover"}`} style={{ width: 44, height: 44, background: "#1F251A", padding: fit ? 2 : 0 }} />;
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
        <RowThumb kind="cocktail" id={c.id} photo={c.photo} name={c.name} clear={c.photo_clear} />
      </span>
    </ItemRow>
  );
}
/** A bottle in a final list: name, its label, the dot, thumbnail and "+"; "out right now" dimmed. */
export function CompactBottle({ b, out, mark, prices }: { b: Pick<IndexBottle, "id" | "name" | "photo" | "available" | "status_label" | "photo_clear">; out: boolean; mark?: Mark; prices?: MenuItem["prices"] }) {
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
        <RowThumb kind="bottle" id={b.id} photo={b.photo} name={b.name} clear={b.photo_clear} />
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
        <RowThumb kind={it.cocktail_id ? "cocktail" : "bottle"} id={it.cocktail_id || it.bottle_id} photo={it.photo} name={it.name} clear={it.photo_clear} />
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
