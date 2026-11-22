import Link from "next/link";
import type { ReactNode } from "react";
import { C } from "./theme";
import type { ArchivedBottle, Bottle, Cocktail, CocktailCard, MenuGroup, MenuItem, MenuPrice, Producer } from "@/lib/passport/bible";

/** File 03a: the library pieces (server-rendered). Only fields from the Bible's approved list. */

export function PageTitle({ kicker, title, children }: { kicker: string; title: string; children?: ReactNode }) {
  return (
    <div className="mb-6">
      <p className="font-body text-[11px] tracking-[0.3em] uppercase" style={{ color: C.brass }}>{kicker}</p>
      <h1 className="font-display text-4xl mt-1" style={{ color: C.text }}>{title}</h1>
      {children}
    </div>
  );
}

export function SectionTitle({ children, aside }: { children: ReactNode; aside?: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between mt-10 mb-3">
      <h2 className="font-body text-[11px] tracking-[0.3em] uppercase" style={{ color: C.brass }}>{children}</h2>
      {aside}
    </div>
  );
}

export function Label({ children, brass = false }: { children: ReactNode; brass?: boolean }) {
  return (
    <span className="font-body text-[10px] tracking-[0.18em] uppercase rounded px-1.5 py-0.5 border whitespace-nowrap"
      style={{ color: brass ? C.brass : C.muted, borderColor: brass ? `${C.brass}80` : C.line }}>
      {children}
    </span>
  );
}

function menuLine(c: CocktailCard) {
  return c.menu_status === "past" ? `Past menu · ${c.menu_name}` : c.menu_name;
}

export function CocktailRow({ c }: { c: CocktailCard }) {
  return (
    <li>
      <Link href={`/passport/library/${c.id}`} className="block py-4 border-b" style={{ borderColor: C.line }}>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-display text-[22px] leading-tight" style={{ color: C.text }}>{c.name}</span>
          {c.passport === "current" && <Label brass>Passport</Label>}
          {c.passport === "past" && <Label>Past Passport cocktail</Label>}
        </div>
        {c.flavor && <p className="font-body text-sm mt-1" style={{ color: C.muted }}>{c.flavor}</p>}
        <p className="font-body text-[11px] tracking-[0.12em] uppercase mt-1.5" style={{ color: C.faint }}>{menuLine(c)}</p>
      </Link>
    </li>
  );
}

/** A Passport cocktail as a feature: everything on its menu card. */
export function CocktailFeature({ c, prices }: { c: Cocktail; prices?: MenuPrice[] }) {
  return (
    <Link href={`/passport/library/${c.id}`} className="block rounded-xl border p-5" style={{ borderColor: `${C.brass}66`, background: "#1a1f14" }}>
      <div className="flex items-baseline justify-between gap-3">
        <div className="font-display text-2xl" style={{ color: C.text }}>{c.name}</div>
        {prices && prices.length > 0 && <Prices prices={prices} />}
      </div>
      {c.tagline && <p className="font-display italic text-[17px] mt-1" style={{ color: C.muted }}>{c.tagline}</p>}
      {c.ingredients && <p className="font-body text-sm mt-3 leading-relaxed" style={{ color: C.text }}>{c.ingredients}</p>}
      {c.flavor && <p className="font-body text-[11px] tracking-[0.15em] uppercase mt-3" style={{ color: C.brass }}>{c.flavor}</p>}
    </Link>
  );
}

export function CocktailPage({ c }: { c: Cocktail }) {
  return (
    <article>
      <Link href="/passport/library" className="font-body text-xs tracking-[0.2em] uppercase" style={{ color: C.muted }}>← Library</Link>
      <div className="mt-5 flex items-center gap-2 flex-wrap">
        {c.passport === "current" && <Label brass>Passport cocktail</Label>}
        {c.passport === "past" && <Label>Past Passport cocktail</Label>}
        <Label>{menuLine(c)}</Label>
      </div>
      <h1 className="font-display text-[40px] leading-[1.05] mt-3" style={{ color: C.text }}>{c.name}</h1>
      {c.tagline && <p className="font-display italic text-xl mt-2" style={{ color: C.muted }}>{c.tagline}</p>}
      <div className="w-14 h-px my-6" style={{ background: C.brass, opacity: 0.6 }} />
      {c.ingredients && (
        <section>
          <h2 className="font-body text-[11px] tracking-[0.3em] uppercase" style={{ color: C.brass }}>In the glass</h2>
          <p className="font-body text-[16px] mt-2 leading-relaxed" style={{ color: C.text }}>
            {c.ingredient_items && c.ingredient_items.length ? c.ingredient_items.map((it, i) => (
              <span key={i}>
                {i > 0 && ", "}
                {it.bottle_id
                  ? <Link href={`/passport/spirits/${it.bottle_id}`} className="underline decoration-1 underline-offset-4" style={{ textDecorationColor: `${C.brass}99` }}>{it.text}</Link>
                  : it.text}
              </span>
            )) : c.ingredients}
          </p>
        </section>
      )}
      {c.flavor && (
        <section className="mt-6">
          <h2 className="font-body text-[11px] tracking-[0.3em] uppercase" style={{ color: C.brass }}>Tastes like</h2>
          <p className="font-body text-[16px] mt-2" style={{ color: C.text }}>{c.flavor}</p>
        </section>
      )}
      {c.notes && <p className="font-body text-[15px] mt-6 leading-relaxed" style={{ color: C.muted }}>{c.notes}</p>}
      {c.home_recipe && (
        <a href={`/passport/library/${c.id}/home-recipe`} className="mt-8 inline-flex items-center gap-2 rounded-lg border px-4 py-2.5 font-body text-sm" style={{ borderColor: `${C.brass}80`, color: C.brass }}>
          Make it at home <span aria-hidden>↓</span><span className="sr-only">(PDF download)</span>
        </a>
      )}
    </article>
  );
}

export function BottleRow({ b }: { b: ArchivedBottle }) {
  return (
    <li>
      <Link href={`/passport/spirits/${b.id}`} className="flex items-baseline justify-between gap-3 py-3 border-b" style={{ borderColor: C.line }}>
        <span className="font-body text-[15px]" style={{ color: C.text }}>{b.name}</span>
        <span className="font-body text-[10px] tracking-[0.15em] uppercase whitespace-nowrap" style={{ color: C.faint }}>{b.status_label}</span>
      </Link>
    </li>
  );
}

/** File 03b: the bottle page. Only fields from the Bible's approved list; only what is filled in. */
export function BottlePage({ b }: { b: Bottle | ArchivedBottle }) {
  const r = b as Partial<Bottle>;
  const archived = b.status_label === "No longer carried";
  // Back to where this bottle lives: the archive, the spirits list (it has pour prices there), else the Library.
  const back = archived ? { href: "/passport/library#archive", label: "Spirits archive" } : r.prices && r.prices.length ? { href: "/passport/spirits", label: "Spirits list" } : { href: "/passport/library", label: "Library" };
  return (
    <article>
      <Link href={back.href} className="font-body text-xs tracking-[0.2em] uppercase" style={{ color: C.muted }}>← {back.label}</Link>
      {b.status_label && <div className="mt-5"><Label>{b.status_label}</Label></div>}
      <h1 className={`font-display text-[38px] leading-[1.05] ${b.status_label ? "mt-3" : "mt-5"}`} style={{ color: C.text }}>{b.name}</h1>
      <p className="font-body text-sm mt-2" style={{ color: C.muted }}>
        {b.category}{b.category && b.producer ? " · " : ""}
        {b.producer && (r.producer_id
          ? <Link href={`/passport/producers/${r.producer_id}`} className="underline decoration-1 underline-offset-4" style={{ textDecorationColor: `${C.brass}99` }}>{b.producer}</Link>
          : b.producer)}
      </p>
      {r.prices && r.prices.length > 0 && <p className="mt-3"><Prices prices={r.prices} /></p>}
      <div className="w-14 h-px my-6" style={{ background: C.brass, opacity: 0.6 }} />
      {/* The Toast description leads; the approved Passport text (Part 6) follows. Either alone reads as complete. */}
      {b.description && <p className="font-body text-[16px] leading-relaxed" style={{ color: C.text }}>{b.description}</p>}
      {r.passport_description && <LongText text={r.passport_description} className={b.description ? "mt-4" : ""} />}
      {r.facts && r.facts.length > 0 && (
        <dl className="mt-6 grid grid-cols-[auto,1fr] gap-x-6 gap-y-2">
          {r.facts.map((f) => (
            <div key={f.label} className="contents">
              <dt className="font-body text-[11px] tracking-[0.2em] uppercase pt-0.5" style={{ color: C.brass }}>{f.label}</dt>
              <dd className="font-body text-[15px]" style={{ color: C.text }}>{f.value}</dd>
            </div>
          ))}
        </dl>
      )}
      {r.cocktails && r.cocktails.length > 0 && (
        <section className="mt-8">
          <h2 className="font-body text-[11px] tracking-[0.3em] uppercase" style={{ color: C.brass }}>In our cocktails</h2>
          <ul className="mt-2">
            {r.cocktails.map((c) => (
              <li key={c.id}>
                <Link href={`/passport/library/${c.id}`} className="flex items-baseline justify-between gap-3 py-3 border-b" style={{ borderColor: C.line }}>
                  <span className="font-display text-[19px]" style={{ color: C.text }}>{c.name}</span>
                  <span className="font-body text-[10px] tracking-[0.15em] uppercase whitespace-nowrap" style={{ color: C.faint }}>{c.menu_status === "past" ? `Past menu · ${c.menu_name}` : c.menu_name}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </article>
  );
}

/** Approved Passport text: plain paragraphs (blank lines split them; stray Markdown marks are dropped). */
function LongText({ text, className = "" }: { text: string; className?: string }) {
  const paras = text.split(/\n\s*\n/).map((t) => t.replace(/^#+\s*/gm, "").replace(/\*\*|__/g, "").trim()).filter(Boolean);
  return (
    <div className={`space-y-3 ${className}`}>
      {paras.map((t, i) => <p key={i} className="font-body text-[15px] leading-relaxed whitespace-pre-line" style={{ color: C.muted }}>{t}</p>)}
    </div>
  );
}

/** File 03b: a producer page: who they are and their bottles a member may open. */
export function ProducerPage({ p }: { p: Producer }) {
  return (
    <article>
      <Link href="/passport/library" className="font-body text-xs tracking-[0.2em] uppercase" style={{ color: C.muted }}>← Library</Link>
      <p className="font-body text-[11px] tracking-[0.3em] uppercase mt-5" style={{ color: C.brass }}>Producer</p>
      <h1 className="font-display text-[38px] leading-[1.05] mt-2" style={{ color: C.text }}>{p.name}</h1>
      {p.based_in && <p className="font-body text-sm mt-2" style={{ color: C.muted }}>{p.based_in}</p>}
      <div className="w-14 h-px my-6" style={{ background: C.brass, opacity: 0.6 }} />
      {p.passport_description && <LongText text={p.passport_description} className="mb-8" />}
      <section>
        <h2 className="font-body text-[11px] tracking-[0.3em] uppercase" style={{ color: C.brass }}>Their bottles</h2>
        <ul className="mt-2">
          {p.bottles.map((b) => (
            <li key={b.id}>
              <Link href={`/passport/spirits/${b.id}`} className="flex items-baseline justify-between gap-3 py-3 border-b" style={{ borderColor: C.line }}>
                <span className="font-body text-[15px]" style={{ color: C.text }}>{b.name}</span>
                <span className="font-body text-[10px] tracking-[0.15em] uppercase whitespace-nowrap" style={{ color: C.faint }}>{b.status_label || b.category}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </article>
  );
}

// ── Toast menus (menu reader) ────────────────────────────────────────────────
const money = (n: number) => `$${Number.isInteger(n) ? n : n.toFixed(2)}`;

/** A price, or pour sizes and prices, as Toast shows them. */
export function Prices({ prices }: { prices: MenuPrice[] }) {
  return (
    <span className="font-body text-[14px] whitespace-nowrap text-right" style={{ color: C.text }}>
      {prices.map((p, i) => (
        <span key={i} className={i ? "ml-3" : ""}>{p.label && <span style={{ color: C.faint }}>{p.label} </span>}{money(p.price)}</span>
      ))}
    </span>
  );
}

function ItemBody({ it }: { it: MenuItem }) {
  return (
    <>
      <div className="flex items-baseline justify-between gap-3">
        <span className="font-display text-[20px] leading-tight" style={{ color: C.text }}>{it.name}</span>
        {it.prices.length > 0 && <Prices prices={it.prices} />}
      </div>
      {it.description && <p className="font-body text-sm mt-1 leading-relaxed" style={{ color: C.muted }}>{it.description}</p>}
    </>
  );
}

/** One menu item: opens its library cocktail when there is one. Cocktails are never marked unavailable. */
export function MenuItemRow({ it }: { it: MenuItem }) {
  const href = it.cocktail_id ? `/passport/library/${it.cocktail_id}` : it.bottle_id ? `/passport/spirits/${it.bottle_id}` : null;
  return (
    <li className="border-b" style={{ borderColor: C.line }}>
      {href ? <Link href={href} className="block py-3"><ItemBody it={it} /></Link> : <div className="py-3"><ItemBody it={it} /></div>}
    </li>
  );
}

/** A spirit on the spirits list: name, pour prices and 86 status; the description is on its bottle page. */
function SpiritRow({ it }: { it: MenuItem }) {
  const body = (
    <div className="flex items-baseline justify-between gap-3 py-2.5">
      <span className="font-body text-[15px]" style={{ color: it.unavailable ? C.faint : C.text }}>
        {it.name}{it.unavailable && <span className="ml-2 align-middle"><Label>Out right now</Label></span>}
      </span>
      {it.prices.length > 0 && <Prices prices={it.prices} />}
    </div>
  );
  return <li className="border-b" style={{ borderColor: C.line }}>{it.bottle_id ? <Link href={`/passport/spirits/${it.bottle_id}`} className="block">{body}</Link> : body}</li>;
}

export function MenuGroupBlock({ g, spirits = false }: { g: MenuGroup; spirits?: boolean }) {
  return (
    <section className="mt-6">
      <h3 className="font-body text-[12px] tracking-[0.2em] uppercase" style={{ color: C.muted }}>{g.name}</h3>
      <ul className="mt-1">{g.items.map((it, i) => (spirits ? <SpiritRow key={i} it={it} /> : <MenuItemRow key={i} it={it} />))}</ul>
    </section>
  );
}

export function Quiet({ children }: { children: ReactNode }) {
  return <p className="font-body text-sm leading-relaxed" style={{ color: C.faint }}>{children}</p>;
}
