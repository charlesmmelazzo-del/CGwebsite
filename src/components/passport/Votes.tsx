"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { C, Notice, postJson } from "./ui";
import { BackLink } from "./bits";
import { useShell } from "./shellContext";
import { notifyChanged } from "./appEvents";
import { PAST_VOTES_HREF, pctLabel, startRound, voteHref, voteKicker } from "@/lib/passport/votes";
import type { Bracket, BracketEntry, BracketMatchup, FlightVote, VoteCard } from "@/lib/passport/types";

/**
 * File 10, Parts 2 to 4: "Choose your perfect flight" and brackets. A member sees their own picks only; while voting is open
 * there are no totals; afterwards the winner, and a whole-percent share only when the bar chose to show one. Never a count.
 */
const kicker = "font-body text-[10px] tracking-[0.25em] uppercase";
const heading = "font-body text-[11px] tracking-[0.3em] uppercase mb-3";

/** A vote or bracket as a card (Home, the Index, Past votes). */
export function VoteCardLink({ c, big = false }: { c: VoteCard; big?: boolean }) {
  const open = c.status === "open";
  return (
    <Link href={voteHref(c)} scroll={false} className="block rounded-xl border p-4 pp-focus pp-row" style={{ borderColor: open ? `${C.brass}80` : C.line, background: open ? "#1a1f14" : C.card }}>
      <span className={`block ${kicker}`} style={{ color: open ? C.brass : C.faint }}>{voteKicker(c)}{open && c.done ? " · you've voted" : ""}</span>
      <span className={`block font-display leading-tight mt-1.5 ${big ? "text-[23px]" : "text-[20px]"}`} style={{ color: C.text }}>{c.title}</span>
      {c.winner && <span className="block font-body text-[15px] mt-1" style={{ color: C.brass }}>Winner: {c.winner}</span>}
      <span className="block font-body text-[12px] mt-1.5" style={{ color: C.muted }}>{c.line}</span>
    </Link>
  );
}
/** Home: any open vote or bracket ("Voting is open"), then results during their window. Nothing at all when there are none. */
export function VotesHome({ open, results }: { open?: VoteCard[] | null; results?: VoteCard[] | null }) {
  if (!open?.length && !results?.length) return null;
  return (
    <section aria-labelledby="pp-votes-home" className="mt-10">
      <h2 id="pp-votes-home" className={heading} style={{ color: C.brass }}>{open?.length ? "Voting is open" : "The results are in"}</h2>
      <ul className="space-y-3">
        {(open || []).map((c) => <li key={`${c.kind}${c.id}`}><VoteCardLink c={c} big /></li>)}
        {(results || []).map((c) => <li key={`r${c.kind}${c.id}`}><VoteCardLink c={c} /></li>)}
      </ul>
    </section>
  );
}

// ── Choose your perfect flight ───────────────────────────────────────────────
export function FlightVotePage({ initial }: { initial: FlightVote }) {
  const shell = useShell();
  const [f, setF] = useState(initial);
  const [busy, setBusy] = useState<number | null>(null);
  const [error, setError] = useState("");
  const open = f.status === "open";
  const pick = async (slotId: number, optionId: number) => {
    if (!open || busy) return;
    const before = f;
    setF({ ...f, slots: f.slots.map((s) => (s.id === slotId ? { ...s, my_pick: optionId } : s)) });
    setBusy(slotId); setError("");
    const r = await postJson<{ flight: FlightVote }>(`/api/passport/votes/${f.id}`, { slot_id: slotId, option_id: optionId });
    setBusy(null);
    if (!r.ok) { setF(before); setError(r.data.error || "Couldn't save your pick. Please try again."); return; }
    setF(r.data.flight);
    if (r.data.flight.done && !before.done) shell?.toast("You've picked in every slot.");
    notifyChanged("votes");
  };
  return (
    <div className="pb-4">
      <BackLink fallback="/passport/library" label="Index" />
      <p className={`${kicker} mt-2`} style={{ color: C.brass }}>Choose your perfect flight · {f.status_label}</p>
      <h1 className="font-display text-4xl leading-tight mt-1" style={{ color: C.text }}>{f.title}</h1>
      {f.intro && <p className="font-body text-[15px] mt-3 leading-relaxed whitespace-pre-line" style={{ color: C.muted }}>{f.intro}</p>}
      <p className="font-body text-sm mt-3" style={{ color: C.text }}>{f.when}{f.pour_oz ? ` · ${f.pour_oz} oz pours` : ""}</p>
      {open && <p className="font-body text-[13px] mt-1" style={{ color: C.faint }}>Pick one bottle in each slot. You can change a pick until voting closes. Results show once it closes.</p>}
      {error && <div className="mt-4"><Notice>{error}</Notice></div>}
      <ol className="mt-6 space-y-7">
        {f.slots.map((s, i) => (
          <li key={s.id}>
            <h2 className="font-body text-[11px] tracking-[0.25em] uppercase" style={{ color: C.brass }}>Slot {i + 1}{s.label ? ` · ${s.label}` : ""}</h2>
            <ul className="mt-2 space-y-2" role={open ? "radiogroup" : undefined} aria-label={`Slot ${i + 1}`}>
              {s.options.map((o) => {
                const mine = s.my_pick === o.id;
                const pct = pctLabel(o.pct);
                return (
                  <li key={o.id} className="flex items-stretch gap-2">
                    <button type="button" role={open ? "radio" : undefined} aria-checked={open ? mine : undefined} disabled={!open || busy === s.id} onClick={() => pick(s.id, o.id)}
                      className="flex-1 min-w-0 text-left rounded-xl border px-4 py-3 min-h-[56px] pp-focus pp-press relative overflow-hidden disabled:cursor-default"
                      style={{ borderColor: mine || o.winner ? C.brass : C.line, background: mine ? "#1a1f14" : C.card }}>
                      {pct && <span aria-hidden className="absolute inset-y-0 left-0" style={{ width: pct, background: `${C.brass}22` }} />}
                      <span className="relative flex items-center gap-3">
                        <span aria-hidden className="w-5 h-5 shrink-0 rounded-full border flex items-center justify-center" style={{ borderColor: mine ? C.brass : C.faint }}>
                          {mine && <span className="w-2.5 h-2.5 rounded-full" style={{ background: C.brass }} />}
                        </span>
                        <span className="flex-1 min-w-0">
                          <span className="block font-body text-[16px] truncate" style={{ color: C.text }}>{o.name}</span>
                          <span className="block font-body text-[11px] tracking-[0.12em] uppercase" style={{ color: C.faint }}>
                            {[o.category, o.winner ? "Winner" : null, mine && !open ? "Your pick" : null].filter(Boolean).join(" · ")}
                          </span>
                        </span>
                        {pct && <span className="font-body text-[15px] shrink-0" style={{ color: o.winner ? C.brass : C.muted }}>{pct}</span>}
                      </span>
                    </button>
                    {o.opens && o.bottle_id && (
                      <Link href={`/passport/spirits/${o.bottle_id}`} scroll={false} aria-label={`About ${o.name}`} className="shrink-0 w-11 rounded-xl border flex items-center justify-center pp-focus pp-press" style={{ borderColor: C.line, color: C.muted }}>→</Link>
                    )}
                  </li>
                );
              })}
            </ul>
          </li>
        ))}
      </ol>
      {open && f.done && <div className="mt-6"><Notice kind="ok">You&rsquo;ve picked in every slot. Thank you! Check back when voting closes.</Notice></div>}
    </div>
  );
}

// ── Brackets ─────────────────────────────────────────────────────────────────
function EntryRow({ e, side, m, open, onPick, busy }: { e: BracketEntry | null; side: "a" | "b"; m: BracketMatchup; open: boolean; onPick: (side: "a" | "b") => void; busy: boolean }) {
  if (!e) return <div className="px-3 py-2.5 font-body text-[13px] min-h-[48px] flex items-center" style={{ color: C.faint }}>To be decided</div>;
  const mine = m.my_pick === side;
  const won = m.winner === side;
  const lost = !!m.winner && !won;
  const pct = pctLabel(side === "a" ? m.a_pct : m.b_pct);
  const href = e.opens && e.id ? (e.kind === "cocktail" ? `/passport/library/${e.id}` : `/passport/spirits/${e.id}`) : null;
  return (
    <div className="flex items-stretch">
      <button type="button" disabled={!open || busy} onClick={() => onPick(side)} aria-pressed={open ? mine : undefined}
        className="flex-1 min-w-0 text-left px-3 py-2.5 min-h-[48px] flex items-center gap-2 pp-focus disabled:cursor-default" style={{ background: mine ? "#1a1f14" : "transparent" }}>
        <span className="font-body text-[11px] w-5 shrink-0 text-right" style={{ color: C.faint }}>{e.seed}</span>
        <span className="flex-1 min-w-0">
          <span className="block font-body text-[15px] truncate" style={{ color: lost ? C.faint : C.text, fontWeight: won ? 600 : 400 }}>{e.name}</span>
          {(mine || won) && <span className="block font-body text-[10px] tracking-[0.15em] uppercase" style={{ color: C.brass }}>{[won ? "Advanced" : null, mine ? "Your pick" : null].filter(Boolean).join(" · ")}</span>}
        </span>
        {pct && <span className="font-body text-[13px] shrink-0" style={{ color: won ? C.brass : C.muted }}>{pct}</span>}
        {open && <span aria-hidden className="w-4 h-4 shrink-0 rounded-full border" style={{ borderColor: mine ? C.brass : C.faint, background: mine ? C.brass : "transparent" }} />}
      </button>
      {href && <Link href={href} scroll={false} aria-label={`Open ${e.name}`} className="shrink-0 w-10 flex items-center justify-center pp-focus" style={{ color: C.muted }}>→</Link>}
    </div>
  );
}
export function BracketPage({ initial }: { initial: Bracket }) {
  const [b, setB] = useState(initial);
  const [busy, setBusy] = useState<number | null>(null);
  const [error, setError] = useState("");
  const scroller = useRef<HTMLDivElement>(null);
  const first = startRound(initial);
  useEffect(() => {
    // Sideways by round, the current round first.
    const el = scroller.current?.querySelector<HTMLElement>(`[data-round="${first}"]`);
    if (el && scroller.current) scroller.current.scrollLeft = el.offsetLeft - scroller.current.offsetLeft;
  }, [first]);
  const vote = async (m: BracketMatchup, side: "a" | "b") => {
    if (!m.id || busy) return;
    const before = b;
    setB({ ...b, rounds: b.rounds.map((r) => ({ ...r, matchups: r.matchups.map((x) => (x.id === m.id ? { ...x, my_pick: side } : x)) })) });
    setBusy(m.id); setError("");
    const r = await postJson<{ bracket: Bracket }>(`/api/passport/brackets/${b.id}`, { matchup_id: m.id, pick: side });
    setBusy(null);
    if (!r.ok) { setB(before); setError(r.data.error || "Couldn't save your pick. Please try again."); return; }
    setB(r.data.bracket);
    notifyChanged("votes");
  };
  return (
    <div className="pb-4">
      <BackLink fallback="/passport/library" label="Index" />
      <p className={`${kicker} mt-2`} style={{ color: C.brass }}>Bracket · {b.kind === "cocktail" ? "cocktails" : "spirits"} · {b.status_label}</p>
      <h1 className="font-display text-4xl leading-tight mt-1" style={{ color: C.text }}>{b.title}</h1>
      {b.intro && <p className="font-body text-[15px] mt-3 leading-relaxed whitespace-pre-line" style={{ color: C.muted }}>{b.intro}</p>}
      <p className="font-body text-sm mt-3" style={{ color: C.text }}>{b.when}</p>
      {b.winner && (
        <div className="mt-5 rounded-xl border p-5" style={{ borderColor: `${C.brass}80`, background: "#1a1f14" }}>
          <p className={kicker} style={{ color: C.brass }}>The winner</p>
          {b.winner.opens && b.winner.id
            ? <Link href={b.winner.kind === "cocktail" ? `/passport/library/${b.winner.id}` : `/passport/spirits/${b.winner.id}`} scroll={false} className="block font-display text-[28px] leading-tight mt-1 pp-focus" style={{ color: C.text }}>{b.winner.name}</Link>
            : <p className="font-display text-[28px] leading-tight mt-1" style={{ color: C.text }}>{b.winner.name}</p>}
        </div>
      )}
      {b.status === "open" && <p className="font-body text-[13px] mt-2" style={{ color: C.faint }}>Tap one in each matchup. You can change it until the round ends; who advances shows after.</p>}
      {error && <div className="mt-4"><Notice>{error}</Notice></div>}
      <div ref={scroller} className="-mx-5 px-5 mt-6 flex gap-4 overflow-x-auto snap-x snap-mandatory pb-3" aria-label="The bracket, round by round">
        {b.rounds.map((r, i) => {
          const open = r.state === "open" && b.status === "open";
          return (
            <section key={r.round} data-round={i} aria-labelledby={`pp-round-${r.round}`} className="snap-start shrink-0 w-[82%] max-w-[300px]">
              <h2 id={`pp-round-${r.round}`} className="font-body text-[11px] tracking-[0.25em] uppercase" style={{ color: r.state === "open" ? C.brass : C.muted }}>
                {r.name}{r.state === "open" ? " · now" : r.state === "done" ? " · done" : ""}
              </h2>
              <p className="font-body text-[11px] mt-0.5 mb-2" style={{ color: C.faint }}>{r.when}</p>
              <ul className="space-y-3">
                {r.matchups.map((m, k) => (
                  <li key={m.id ?? `p${k}`} className="rounded-xl border overflow-hidden divide-y divide-[#323B29]" style={{ borderColor: open && m.id ? `${C.brass}66` : C.line, background: C.card }}>
                    <EntryRow e={m.a} side="a" m={m} open={open && !!m.id} busy={busy === m.id} onPick={(s) => vote(m, s)} />
                    <EntryRow e={m.b} side="b" m={m} open={open && !!m.id} busy={busy === m.id} onPick={(s) => vote(m, s)} />
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
      {b.rounds.length > 1 && <p className="font-body text-[11px] mt-1" style={{ color: C.faint }}>Swipe sideways for the other rounds.</p>}
    </div>
  );
}

/** "Past votes": finished flights and brackets with their results. */
export function PastVotes({ votes }: { votes: VoteCard[] }) {
  return (
    <div>
      <BackLink fallback="/passport/library" label="Index" />
      <p className={`${kicker} mt-2`} style={{ color: C.brass }}>From Common Good</p>
      <h1 className="font-display text-4xl leading-tight mt-1" style={{ color: C.text }}>Past votes</h1>
      {votes.length
        ? <ul className="mt-6 space-y-3">{votes.map((c) => <li key={`${c.kind}${c.id}`}><VoteCardLink c={c} /></li>)}</ul>
        : <p className="font-body text-sm mt-6" style={{ color: C.muted }}>Finished votes and brackets will be kept here.</p>}
    </div>
  );
}
export { PAST_VOTES_HREF };
