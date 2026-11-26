"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { C, Notice, postJson } from "./ui";
import { BackLink, ItemRow } from "./bits";
import { Thumb } from "./PhotoBits";
import { useShell } from "./shellContext";
import { notifyChanged } from "./appEvents";
import { TAX_LINE, flightLine, houseHref, listKicker, pourLabel } from "@/lib/passport/bar";
import type { Chart, HouseItem, HouseList, PassportList } from "@/lib/passport/types";

/**
 * File 07: a house list or a chart, over the tab it was opened from. Each item opens its page (and has "+" and
 * long-press, as every card does); an item that can no longer be opened shows by name only. "Save a copy to my lists"
 * makes the member's own list in one tap. Comments arrive in the next file: <ListComments /> is their place.
 */
export function HouseListPage({ list, chart }: { list?: HouseList; chart?: Chart }) {
  const items: HouseItem[] = (list ? list.items : chart?.items) || [];
  const ranked = chart ? true : !!list?.ranked;
  const title = list ? list.title : chart!.title;
  const flight = list ? flightLine(list.price) : null;
  const kicker = list ? listKicker(list) : chart!.season_name;
  return (
    <article>
      <BackLink fallback="/passport/library#from-common-good" label="Index" />
      <p className="font-body text-[0.75rem] tracking-[0.3em] uppercase mt-3" style={{ color: C.brass }}>{kicker}{list?.past && !list.chart ? " · Past list" : ""}</p>
      <h1 className="font-display text-[2.375rem] leading-[1.05] mt-2" style={{ color: C.text }}>{title}</h1>
      {list?.intro && <p className="font-body text-[1rem] mt-3 leading-relaxed whitespace-pre-line" style={{ color: C.muted }}>{list.intro}</p>}
      {flight && (
        <p className="mt-3 font-body text-[1rem]" style={{ color: C.text }}>
          {flight} <span className="text-sm" style={{ color: C.faint }}>{TAX_LINE}</span>
        </p>
      )}
      <div className="w-14 h-px my-6" style={{ background: C.brass, opacity: 0.6 }} />
      {items.length ? (
        <ol>
          {items.map((it, i) => <HouseRow key={`${it.id ?? "x"}-${i}`} it={it} rank={ranked ? i + 1 : null} />)}
        </ol>
      ) : <p className="font-body text-sm" style={{ color: C.faint }}>Nothing on this list right now.</p>}
      {items.some((x) => x.opens) && <SaveCopy body={list ? { list: list.id } : { chart: chart!.key }} />}
      <ListComments />
    </article>
  );
}

function HouseRow({ it, rank }: { it: HouseItem; rank: number | null }) {
  const href = it.opens && it.id ? (it.kind === "cocktail" ? `/passport/library/${it.id}` : `/passport/spirits/${it.id}`) : null;
  const pour = pourLabel(it.pour_oz);
  const body: ReactNode = (
    <span className="flex items-baseline gap-3">
      {rank !== null && <span className="font-display text-[1.375rem] w-7 text-right shrink-0" style={{ color: C.brass }}>{rank}</span>}
      <span className="flex-1 min-w-0">
        <span className="flex items-baseline gap-2 flex-wrap">
          <span className={it.kind === "cocktail" ? "font-display text-[1.3125rem] leading-tight" : "font-body text-[1rem]"} style={{ color: href ? C.text : C.muted }}>{it.name}</span>
          {it.label && <span className="font-body text-[0.75rem] tracking-[0.15em] uppercase whitespace-nowrap" style={{ color: C.faint }}>{it.label}</span>}
          {pour && <span className="font-body text-[0.875rem] ml-auto whitespace-nowrap" style={{ color: C.muted }}>{pour}</span>}
        </span>
        {it.note && <span className="block font-body text-sm mt-0.5 leading-relaxed" style={{ color: C.muted }}>{it.note}</span>}
      </span>
      {href && <span className="self-center"><Thumb kind={it.kind} id={it.id} photo={it.photo} size={48} /></span>}
    </span>
  );
  return <ItemRow item={href && it.id ? { kind: it.kind, id: it.id, name: it.name } : null} href={href} pad="py-3">{body}</ItemRow>;
}

/** One tap: the member's own copy, in the same order (a ranked list of more than ten is saved as a playlist). */
function SaveCopy({ body }: { body: { list: number } | { chart: string } }) {
  const shell = useShell();
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState<PassportList | null>(null);
  const [error, setError] = useState("");
  if (saved) {
    return (
      <p className="mt-8 font-body text-sm" role="status" style={{ color: C.muted }}>
        Saved to your lists. <Link href={`/passport/lists/${saved.id}`} scroll={false} className="underline underline-offset-4" style={{ color: C.text }}>Open your copy</Link>
      </p>
    );
  }
  return (
    <div className="mt-8">
      <button type="button" disabled={busy} onClick={async () => {
        setBusy(true); setError("");
        const r = await postJson<{ list: PassportList }>("/api/passport/house/save", body);
        setBusy(false);
        if (r.ok && r.data.list) { setSaved(r.data.list); notifyChanged("lists"); shell?.toast("Saved to your lists"); }
        else setError(r.data.error || "Couldn't save that. Please try again.");
      }} className="w-full rounded-full border min-h-[48px] font-body text-[0.875rem] tracking-[0.18em] uppercase pp-focus pp-press disabled:opacity-60"
        style={{ borderColor: C.brass, color: C.brass }}>{busy ? "Saving…" : "Save a copy to my lists"}</button>
      {error && <div className="mt-3"><Notice>{error}</Notice></div>}
    </div>
  );
}

/** Comments on house lists arrive in the next build file. Their place is here, below the list; nothing shows yet. */
function ListComments() { return null; }

/** "Past lists from Common Good": lists that have ended, and past seasons' final charts. */
export function PastLists({ lists }: { lists: HouseList[] }) {
  return (
    <article>
      <BackLink fallback="/passport/library#from-common-good" label="Index" />
      <p className="font-body text-[0.75rem] tracking-[0.3em] uppercase mt-3" style={{ color: C.brass }}>From Common Good</p>
      <h1 className="font-display text-[2.375rem] leading-[1.05] mt-2" style={{ color: C.text }}>Past lists</h1>
      <div className="w-14 h-px my-6" style={{ background: C.brass, opacity: 0.6 }} />
      {lists.length ? (
        <ul>
          {lists.map((l) => (
            <li key={l.id} className="border-b" style={{ borderColor: C.line }}>
              <Link href={houseHref(l.id)} scroll={false} className="block py-3.5 pp-row pp-focus rounded-sm">
                <span className="block font-display text-[1.3125rem] leading-tight" style={{ color: C.text }}>{l.title}</span>
                <span className="block font-body text-[0.75rem] tracking-[0.12em] uppercase mt-1" style={{ color: C.faint }}>
                  {listKicker(l)} · {l.count} {l.kind === "cocktail" ? "cocktail" : "bottle"}{l.count === 1 ? "" : "s"}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : <p className="font-body text-sm" style={{ color: C.faint }}>No past lists yet.</p>}
    </article>
  );
}
