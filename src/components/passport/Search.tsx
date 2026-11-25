"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { C } from "./theme";
import { Avail, ItemRow, Skel } from "./bits";
import { resultCount, searchable } from "@/lib/passport/shell";
import type { FindResults } from "@/lib/passport/types";

/**
 * File 06: the one search bar, the same on Menu and Index. Cocktails, bottles and producers, grouped under those three
 * headings with the available-now marker. Results appear as the member types, after a short pause, without leaving
 * the tab; clearing the box brings the tab back exactly as it was. Only things the member may open (the Bible decides).
 */
export default function SearchArea({ initial = "", children }: { initial?: string; children: ReactNode }) {
  const inputId = useId();
  const [q, setQ] = useState(initial);
  const [results, setResults] = useState<FindResults | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const seq = useRef(0);
  const active = searchable(q);
  useEffect(() => {
    const n = ++seq.current;
    if (!searchable(q)) { setResults(null); setBusy(false); setError(""); return; }
    setBusy(true);
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/passport/find?${new URLSearchParams({ q: q.trim() }).toString()}`, { cache: "no-store" });
        const data = await res.json().catch(() => ({}));
        if (n !== seq.current) return;
        setBusy(false);
        if (res.status === 401 && data.signed_out) { window.location.assign("/passport?signed_out=1"); return; }
        if (!res.ok) { setError(data.error || "Search is unavailable right now. Please try again."); return; }
        setError("");
        setResults(data as FindResults);
      } catch {
        if (n === seq.current) { setBusy(false); setError("You seem to be offline."); }
      }
    }, 260);
    return () => clearTimeout(t);
  }, [q]);

  return (
    <div>
      <form role="search" onSubmit={(e) => { e.preventDefault(); (document.activeElement as HTMLElement | null)?.blur?.(); }} className="relative">
        <label className="sr-only" htmlFor={inputId}>Search cocktails, bottles and producers</label>
        <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={C.faint} strokeWidth="1.8" strokeLinecap="round" aria-hidden>
          <circle cx="11" cy="11" r="6.5" /><path d="m16 16 4 4" />
        </svg>
        <input id={inputId} value={q} onChange={(e) => setQ(e.target.value)} type="search" enterKeyHint="search" autoComplete="off" autoCorrect="off" spellCheck={false}
          placeholder="Cocktails, bottles, producers"
          className="w-full rounded-xl pl-10 pr-11 min-h-[48px] font-body text-[16px] bg-[#0E120B] border border-[#323B29] text-[#EDE6D3] placeholder:text-[#5d6a52] focus:outline-none focus:border-[#C9A96E] focus:ring-1 focus:ring-[#C9A96E]/40 [&::-webkit-search-cancel-button]:appearance-none" />
        {q && (
          <button type="button" onClick={() => setQ("")} aria-label="Clear search" className="absolute right-1 top-1/2 -translate-y-1/2 w-11 h-11 flex items-center justify-center rounded-full pp-focus" style={{ color: C.muted }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden><path d="M6 6l12 12M18 6 6 18" /></svg>
          </button>
        )}
      </form>
      {active ? <Results q={q.trim()} results={results} busy={busy} error={error} /> : children}
    </div>
  );
}

function Heading({ children, n }: { children: ReactNode; n: number }) {
  return (
    <h2 className="flex items-baseline justify-between mt-8 mb-1 font-body text-[11px] tracking-[0.3em] uppercase" style={{ color: C.brass }}>
      {children}<span className="tracking-normal text-[12px]" style={{ color: C.faint }}>{n}</span>
    </h2>
  );
}

function Results({ q, results, busy, error }: { q: string; results: FindResults | null; busy: boolean; error: string }) {
  const n = resultCount(results);
  return (
    <div className="mt-2" aria-busy={busy}>
      <p className="sr-only" role="status" aria-live="polite">{results && !busy ? `${n} result${n === 1 ? "" : "s"} for ${q}` : ""}</p>
      {error && <p role="alert" className="mt-6 font-body text-sm" style={{ color: "#f0c4b2" }}>{error}</p>}
      {!results && !error && (
        <div className="mt-8 space-y-4" aria-hidden><Skel w="30%" h={10} /><Skel w="70%" h={18} /><Skel w="55%" h={18} /><Skel w="62%" h={18} /></div>
      )}
      {results && (
        <div style={{ opacity: busy ? 0.55 : 1, transition: "opacity 0.15s" }}>
          {results.cocktails.length > 0 && (
            <section>
              <Heading n={results.cocktails.length}>Cocktails</Heading>
              <ul>
                {results.cocktails.map((c) => (
                  <ItemRow key={c.id} item={{ kind: "cocktail", id: c.id, name: c.name }} href={`/passport/library/${c.id}`}>
                    <span className="flex items-center gap-2">
                      <span className="font-display text-[20px] leading-tight" style={{ color: C.text }}>{c.name}</span>
                      <Avail on={c.available} />
                    </span>
                    <span className="block font-body text-[11px] tracking-[0.12em] uppercase mt-1" style={{ color: C.faint }}>
                      {c.passport === "current" ? "Passport · " : ""}{c.menu_status === "past" ? `Past menu · ${c.menu_name}` : c.menu_name}
                    </span>
                  </ItemRow>
                ))}
              </ul>
            </section>
          )}
          {results.bottles.length > 0 && (
            <section>
              <Heading n={results.bottles.length}>Bottles</Heading>
              <ul>
                {results.bottles.map((b) => (
                  <ItemRow key={b.id} item={{ kind: "bottle", id: b.id, name: b.name }} href={`/passport/spirits/${b.id}`}>
                    <span className="flex items-center gap-2">
                      <span className="font-body text-[15px]" style={{ color: C.text }}>{b.name}</span>
                      <Avail on={b.available} />
                    </span>
                    <span className="block font-body text-[10px] tracking-[0.15em] uppercase mt-1" style={{ color: C.faint }}>
                      {[b.category, b.status_label].filter(Boolean).join(" · ")}
                    </span>
                  </ItemRow>
                ))}
              </ul>
            </section>
          )}
          {results.producers.length > 0 && (
            <section>
              <Heading n={results.producers.length}>Producers</Heading>
              <ul>
                {results.producers.map((p) => (
                  <li key={p.id} className="border-b" style={{ borderColor: C.line }}>
                    <Link href={`/passport/producers/${p.id}`} scroll={false} className="flex items-baseline justify-between gap-3 py-3 min-h-[48px] pp-focus pp-row rounded-sm">
                      <span className="font-body text-[15px]" style={{ color: C.text }}>{p.name}</span>
                      {p.based_in && <span className="font-body text-xs text-right" style={{ color: C.faint }}>{p.based_in}</span>}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
          {n === 0 && !busy && <p className="mt-8 font-body text-sm" style={{ color: C.faint }}>Nothing matches “{q}”. Try one word, like a spirit or a producer.</p>}
        </div>
      )}
    </div>
  );
}
