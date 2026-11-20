"use client";

// ─── The zone list ───────────────────────────────────────────────────────────
// The same opportunities as the ornaments, as a plain list. This is the
// accessible path: everything a guest can do on the tree works from here with
// a keyboard or a screen reader.

import { useEffect, useRef } from "react";
import { COPY } from "@/lib/givingTree/copy";
import { money } from "@/lib/givingTree/rules";
import type { OppType, PublicOpportunity, PublicOrg } from "@/lib/givingTree/types";

export default function ZoneList({
  zone,
  opportunities,
  orgs,
  onOpen,
  onClose,
}: {
  zone: OppType | "all";
  opportunities: PublicOpportunity[];
  orgs: Map<string, PublicOrg>;
  onOpen: (o: PublicOpportunity) => void;
  onClose: () => void;
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => heading.current?.focus(), [zone]);
  const title = zone === "all" ? COPY.treeTitle : COPY.zoneListTitle(COPY.zoneLabels[zone]);

  return (
    <section className="gt-sheet" aria-label={title}>
      <div className="flex items-center justify-between gap-2 px-4 pt-3 pb-2 border-b border-black/10">
        <h2 ref={heading} tabIndex={-1} className="gt-display text-[var(--gt-size-l)]">
          {title}
        </h2>
        <button type="button" className="gt-btn gt-btn-small" onClick={onClose}>
          {COPY.close}
        </button>
      </div>
      {opportunities.length === 0 ? (
        <p className="p-4">{COPY.zoneEmpty}</p>
      ) : (
        <ul className="overflow-y-auto px-2 py-2">
          {opportunities.map((o) => (
            <li key={o.id}>
              <button type="button" className="w-full text-left px-2 py-2.5 rounded-lg hover:bg-black/5 flex gap-3 items-start" onClick={() => onOpen(o)}>
                <span aria-hidden="true" className="mt-1 h-3.5 w-3.5 shrink-0 rounded-full gt-ornament !static !transform-none !border !shadow-none" data-zone={o.zone} />
                <span className="min-w-0">
                  <span className="block font-semibold">{o.title}</span>
                  <span className="block gt-small gt-muted">
                    {orgs.get(o.orgId)?.name}
                    {o.type !== "cash" && o.spots > 1 ? ` · ${COPY.spotsLeft(o.spotsLeft, o.spots)}` : ""}
                    {o.type === "cash" && o.meterValue != null ? ` · ${money(o.meterValue)}${o.goalAmount ? ` of ${money(o.goalAmount)}` : ""}` : ""}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
