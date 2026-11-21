import Link from "next/link";
import type { ReactNode } from "react";
import { C } from "./theme";
import type { ArchivedBottle, Cocktail, CocktailCard } from "@/lib/passport/bible";

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
export function CocktailFeature({ c }: { c: Cocktail }) {
  return (
    <Link href={`/passport/library/${c.id}`} className="block rounded-xl border p-5" style={{ borderColor: `${C.brass}66`, background: "#1a1f14" }}>
      <div className="font-display text-2xl" style={{ color: C.text }}>{c.name}</div>
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
          <p className="font-body text-[16px] mt-2 leading-relaxed" style={{ color: C.text }}>{c.ingredients}</p>
        </section>
      )}
      {c.flavor && (
        <section className="mt-6">
          <h2 className="font-body text-[11px] tracking-[0.3em] uppercase" style={{ color: C.brass }}>Tastes like</h2>
          <p className="font-body text-[16px] mt-2" style={{ color: C.text }}>{c.flavor}</p>
        </section>
      )}
      {c.notes && <p className="font-body text-[15px] mt-6 leading-relaxed" style={{ color: C.muted }}>{c.notes}</p>}
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

export function BottlePage({ b }: { b: ArchivedBottle }) {
  return (
    <article>
      <Link href="/passport/library#archive" className="font-body text-xs tracking-[0.2em] uppercase" style={{ color: C.muted }}>← Spirits archive</Link>
      <div className="mt-5"><Label>{b.status_label}</Label></div>
      <h1 className="font-display text-[38px] leading-[1.05] mt-3" style={{ color: C.text }}>{b.name}</h1>
      <p className="font-body text-sm mt-2" style={{ color: C.muted }}>{[b.category, b.producer].filter(Boolean).join(" · ")}</p>
      <div className="w-14 h-px my-6" style={{ background: C.brass, opacity: 0.6 }} />
      {b.description
        ? <p className="font-body text-[16px] leading-relaxed" style={{ color: C.text }}>{b.description}</p>
        : <p className="font-body text-sm" style={{ color: C.faint }}>No description yet.</p>}
      <p className="font-body text-xs mt-8" style={{ color: C.faint }}>The full bottle story, and your own notes, arrive soon.</p>
    </article>
  );
}

export function Quiet({ children }: { children: ReactNode }) {
  return <p className="font-body text-sm leading-relaxed" style={{ color: C.faint }}>{children}</p>;
}
