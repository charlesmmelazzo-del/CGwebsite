"use client";

// ─── The sky: "What we've given" ─────────────────────────────────────────────
// Every public pledge is a star, laid out from data on a spiral (see
// lib/givingTree/layout), so the field simply grows as the season goes on.
// Labels appear once zoomed in far enough to read them.

import { useEffect, useMemo, useRef, useState } from "react";
import { COPY } from "@/lib/givingTree/copy";
import { money } from "@/lib/givingTree/rules";
import type { Counters as CountersT, PublicStar } from "@/lib/givingTree/types";
import PanZoom, { type PanZoomHandle } from "./PanZoom";

const PX = 9; // sky units → content pixels
const PAD = 120;

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

export default function Sky({
  stars,
  counters,
  highlight,
  heading,
  intro,
  onBack,
  backLabel,
  actions,
}: {
  stars: PublicStar[];
  counters: CountersT;
  highlight: string | null;
  heading: string;
  intro?: string;
  onBack?: () => void;
  backLabel?: string;
  actions?: React.ReactNode;
}) {
  const pz = useRef<PanZoomHandle>(null);
  const [open, setOpen] = useState<PublicStar | null>(null);

  const box = useMemo(() => {
    let minX = 0, maxX = 0, minY = 0, maxY = 0;
    for (const s of stars) {
      minX = Math.min(minX, s.x); maxX = Math.max(maxX, s.x);
      minY = Math.min(minY, s.y); maxY = Math.max(maxY, s.y);
    }
    return { minX, minY, w: (maxX - minX) * PX + PAD * 2, h: (maxY - minY) * PX + PAD * 2 };
  }, [stars]);

  const pos = (s: PublicStar) => ({ left: (s.x - box.minX) * PX + PAD, top: (s.y - box.minY) * PX + PAD });

  // Glide to a newly hung star.
  useEffect(() => {
    const s = highlight && stars.find((x) => x.id === highlight);
    if (!s) return;
    const p = pos(s);
    const t = window.setTimeout(() => pz.current?.zoomTo({ x: p.left - 120, y: p.top - 80, w: 240, h: 160 }, { maxScale: 2.2 }), 300);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [highlight, stars.length]);

  return (
    <div className="h-full flex flex-col gt-sky">
      <header className="px-3 pt-3 pb-2 space-y-2 max-w-[var(--gt-sheet-max)] w-full mx-auto">
        <div className="flex items-center justify-between gap-2">
          <h1 className="gt-display text-[var(--gt-size-xl)]">{heading}</h1>
          {onBack && (
            <button type="button" className="gt-btn gt-btn-small" onClick={onBack}>
              {backLabel ?? COPY.backToTree}
            </button>
          )}
        </div>
        {intro && <p className="gt-small gt-muted">{intro}</p>}
        <Counters c={counters} />
        {actions}
      </header>
      <PanZoom ref={pz} width={box.w} height={box.h} maxFitScale={1.6} maxScale={5} className="flex-1 min-h-0" label={heading}>
        {(scale) => (
          <>
            {stars.length === 0 && (
              <p className="absolute inset-0 flex items-center justify-center gt-muted text-center" style={{ fontSize: 16 / scale }}>
                {COPY.skyEmpty}
              </p>
            )}
            {stars.map((s) => (
              <button
                key={s.id}
                type="button"
                className="gt-star"
                data-new={s.id === highlight ? "true" : "false"}
                style={pos(s)}
                onClick={() => setOpen(s)}
                aria-label={`${s.label}${s.note ? `: ${s.note}` : ""}`}
              >
                <span className="gt-star-dot" />
                {(scale > 0.7 || s.id === highlight) && <span className="gt-star-label">{s.label}</span>}
              </button>
            ))}
          </>
        )}
      </PanZoom>
      {open && (
        <div className="gt-overlay" onClick={(e) => e.target === e.currentTarget && setOpen(null)}>
          <div role="dialog" aria-modal="true" aria-label={open.label} className="gt-dialog gt-card p-5 space-y-2">
            <p className="gt-display text-[var(--gt-size-l)]">{open.label}</p>
            {open.note && <p className="italic">“{open.note}”</p>}
            {open.gave && <p className="gt-small">{open.gave}</p>}
            <button type="button" className="gt-btn w-full" autoFocus onClick={() => setOpen(null)}>
              {COPY.close}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
