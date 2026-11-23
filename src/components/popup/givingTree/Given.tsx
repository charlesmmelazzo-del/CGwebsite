"use client";

// ─── "What we've given": the stocking wall ───────────────────────────────────
//
// Every public pledge is a stocking with the guest's name on the cuff, listed
// by section (volunteering, gifts, donations), newest first, in a plain
// scrolling list. Right after a guest hangs an ornament they land here: their
// stocking drops onto the line next to everyone else's, with their code and
// next steps above it.

import { motion } from "framer-motion";
import { useEffect, useMemo, useRef, useState } from "react";
import { COPY } from "@/lib/givingTree/copy";
import { longDate } from "@/lib/givingTree/format";
import { money } from "@/lib/givingTree/rules";
import type { Counters as CountersT, OppType, PublicStar } from "@/lib/givingTree/types";
import type { ClaimSuccess } from "./ClaimForm";
import { useReducedMotion } from "./motion";

const SECTIONS: OppType[] = ["volunteer", "gift", "cash"];

export function Counters({ c }: { c: CountersT }) {
  const items: [string, string][] = [
    [String(c.hours % 1 === 0 ? c.hours : c.hours.toFixed(1)), COPY.counters.hours],
    [money(c.dollars), COPY.counters.dollars],
    [String(c.giftsPromised), COPY.counters.giftsPromised],
    [String(c.giftsReceived), COPY.counters.giftsReceived],
    [String(c.neighbors), COPY.counters.neighbors],
  ];
  return (
    <dl className="gt-counters">
      {items.map(([n, l]) => (
        <div key={l} className="flex flex-col-reverse">
          <dt className="gt-counter-l">{l}</dt>
          <dd className="gt-counter-n">{n}</dd>
        </div>
      ))}
    </dl>
  );
}

/** A stocking, drawn in SVG, with the name on the cuff. */
function StockingShape({ type, name }: { type: OppType; name: string }) {
  return (
    <span className="gt-stocking-shape" data-zone={type}>
      <svg viewBox="0 0 100 130" aria-hidden="true">
        <path className="gt-stocking-body" d="M16 30 V88 Q16 118 46 120 L74 120 Q96 120 96 100 Q96 84 78 82 L66 80 V30 Z" />
        <rect className="gt-stocking-cuff" x="8" y="10" width="66" height="26" rx="5" />
        <circle className="gt-stocking-loop" cx="14" cy="8" r="5" />
      </svg>
      {/* Long words get smaller type so a name like "Anonymous" fits whole. */}
      <span className="gt-stocking-name" data-long={name.split(/\s+/).some((w) => w.length > 7) ? "true" : "false"}>
        {name}
      </span>
    </span>
  );
}

function Stocking({ s, isNew, onOpen }: { s: PublicStar; isNew: boolean; onOpen: () => void }) {
  const reduced = useReducedMotion();
  const hang = isNew && !reduced;
  return (
    <li className="gt-stocking-slot" data-new={isNew ? "true" : "false"}>
      <motion.button
        type="button"
        className="gt-stocking"
        onClick={onOpen}
        aria-label={`${s.label}${s.gave ? `, ${s.gave}` : ""}${s.note ? `: ${s.note}` : ""}`}
        style={{ transformOrigin: "20% 0%" }}
        // The drop and swing wait until the stocking is on screen, so it's
        // seen even when the confirmation above pushes it down the page.
        initial={hang ? { y: -140, opacity: 0, rotate: -14 } : false}
        whileInView={hang ? { y: [-140, 0, 0, 0, 0, 0], opacity: [0, 1, 1, 1, 1, 1], rotate: [-14, -14, 9, -5, 2, 0] } : undefined}
        viewport={{ once: true, amount: 0.4 }}
        transition={hang ? { duration: 2.2, delay: 0.3, times: [0, 0.3, 0.5, 0.7, 0.85, 1], ease: "easeOut" } : undefined}
      >
        <StockingShape type={s.type} name={s.label} />
        {s.gave && <span className="gt-stocking-gave">{s.gave}</span>}
        {s.note && <span className="gt-stocking-note">“{s.note}”</span>}
      </motion.button>
    </li>
  );
}

function Confirmation({ s, onDone }: { s: ClaimSuccess; onDone: () => void }) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => heading.current?.focus(), []);
  return (
    <section className="gt-card p-4 space-y-3" aria-labelledby="gt-success-title">
      <h2 id="gt-success-title" ref={heading} tabIndex={-1} className="gt-display text-[length:var(--gt-size-xl)] text-center">
        {COPY.successTitle}
      </h2>
      {s.type === "gift" ? (
        <>
          <p className="rounded-lg p-3 bg-black/5 text-[length:var(--gt-size-l)] font-semibold">{COPY.giftCodeFirst(s.code)}</p>
          {s.dropoff && <p>{s.dropoff}</p>}
          {s.dueDate && <p>{COPY.giftDue(longDate(s.dueDate))}</p>}
        </>
      ) : (
        <p className="text-center">
          {COPY.codeLabel}: <span className="font-mono text-[length:var(--gt-size-l)] font-semibold tracking-widest">{s.code}</span>
        </p>
      )}
      {s.type === "volunteer" && <p>{COPY.volunteerNext(s.orgName)}</p>}
      {s.type === "cash" && s.giveUrl && (
        <a className="gt-btn gt-btn-primary w-full" href={s.giveUrl} target="_blank" rel="noopener noreferrer">
          {COPY.cashContinue(s.orgName)}
        </a>
      )}
      <p className="gt-small gt-muted">{COPY.emailSent}</p>
      <button type="button" className={`gt-btn w-full ${s.type === "cash" ? "" : "gt-btn-primary"}`} onClick={onDone}>
        {COPY.done}
      </button>
    </section>
  );
}

export default function Given({
  stockings,
  counters,
  heading,
  intro,
  mine,
  onDismissMine,
  actions,
}: {
  stockings: PublicStar[];
  counters: CountersT;
  heading: string;
  intro?: string;
  /** The pledge the guest just made, if they've just hung an ornament. */
  mine: ClaimSuccess | null;
  onDismissMine: () => void;
  actions?: React.ReactNode;
}) {
  const [section, setSection] = useState<OppType | "all">(mine ? mine.type : "all");
  const [open, setOpen] = useState<PublicStar | null>(null);
  // The guest's own stocking stays highlighted after they close the confirmation.
  const [newId, setNewId] = useState<string | null>(mine?.star.id ?? null);
  const scroller = useRef<HTMLDivElement>(null);

  // Arriving with a new stocking: show its section, from the top.
  useEffect(() => {
    if (!mine) return;
    setSection(mine.type);
    setNewId(mine.star.id);
    scroller.current?.scrollTo({ top: 0 });
  }, [mine]);

  const bySection = useMemo(() => {
    const m: Record<OppType, PublicStar[]> = { volunteer: [], gift: [], cash: [] };
    for (const s of stockings) m[s.type]?.push(s);
    for (const k of SECTIONS) m[k].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return m;
  }, [stockings]);

  const shown = section === "all" ? SECTIONS.filter((k) => bySection[k].length > 0) : [section];

  return (
    <div ref={scroller} className="h-full overflow-y-auto gt-given">
      <div className="max-w-[var(--gt-sheet-max)] mx-auto px-3 pt-3 pb-6 space-y-4">
        <header className="space-y-2">
          <h1 className="gt-display text-[length:var(--gt-size-xl)]">{heading}</h1>
          {intro && <p className="gt-small gt-muted">{intro}</p>}
          <Counters c={counters} />
          {actions}
        </header>

        {mine && <Confirmation s={mine} onDone={onDismissMine} />}

        {stockings.length === 0 ? (
          <p className="gt-given-empty">{COPY.givenEmpty}</p>
        ) : (
          <>
            <div className="flex gap-2 overflow-x-auto gt-noscroll" role="group" aria-label={heading}>
              <button type="button" className="gt-btn gt-btn-small shrink-0" aria-pressed={section === "all"} onClick={() => setSection("all")}>
                {COPY.givenAll} ({stockings.length})
              </button>
              {SECTIONS.map((k) => (
                <button key={k} type="button" className="gt-btn gt-btn-small shrink-0" aria-pressed={section === k} onClick={() => setSection(k)}>
                  {COPY.givenSections[k]} ({bySection[k].length})
                </button>
              ))}
            </div>

            {shown.map((k) => (
              <section key={k} aria-label={COPY.givenSections[k]}>
                <h2 className="gt-display text-[length:var(--gt-size-l)] mb-2">{COPY.givenSections[k]}</h2>
                {bySection[k].length === 0 ? (
                  <p className="gt-small gt-muted">{COPY.givenSectionEmpty}</p>
                ) : (
                  <ul className="gt-stockings">
                    {bySection[k].map((s) => (
                      <Stocking key={s.id} s={s} isNew={s.id === newId} onOpen={() => setOpen(s)} />
                    ))}
                  </ul>
                )}
              </section>
            ))}
          </>
        )}
      </div>

      {open && (
        <div className="gt-overlay" onClick={(e) => e.target === e.currentTarget && setOpen(null)}>
          <div role="dialog" aria-modal="true" aria-label={open.label} className="gt-dialog gt-card p-5 space-y-2">
            <p className="gt-display text-[length:var(--gt-size-l)]">{open.label}</p>
            {open.gave && <p className="gt-small">{open.gave}</p>}
            {open.note && <p className="italic">“{open.note}”</p>}
            <button type="button" className="gt-btn w-full" autoFocus onClick={() => setOpen(null)}>
              {COPY.close}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
