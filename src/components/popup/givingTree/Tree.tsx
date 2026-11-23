"use client";

// ─── The tree: "Ways to give" ────────────────────────────────────────────────
// Drawn from data: the outline and zones come from lib/givingTree/layout, each
// ornament sits at the position the server worked out for it.

import { forwardRef } from "react";
import { COPY } from "@/lib/givingTree/copy";
import { LABEL_ROOM, TIERS, TREE, ZONES, tierPaths, zoneHalfWidth } from "@/lib/givingTree/layout";
import type { OppType, PublicOpportunity } from "@/lib/givingTree/types";
import PanZoom, { type PanZoomHandle } from "./PanZoom";

/** Tree units to content pixels. */
export const UNIT = 10;
export const TREE_W = TREE.width * UNIT;
export const TREE_H = TREE.height * UNIT;

export function ornamentRect(o: PublicOpportunity) {
  const s = o.size * UNIT;
  return { x: o.x * UNIT - s, y: o.y * UNIT - s, w: s * 2, h: s * 2 };
}

export function zoneRect(zone: OppType) {
  const z = ZONES.find((x) => x.key === zone)!;
  const half = zoneHalfWidth(zone);
  return { x: (TREE.centerX - half) * UNIT, y: z.y0 * UNIT, w: half * 2 * UNIT, h: (z.y1 - z.y0) * UNIT };
}

export function Ornament({ o, size, dim, onOpen }: { o: PublicOpportunity; size: number; dim: boolean; onOpen: () => void }) {
  const px = size * UNIT;
  const showSpots = o.type !== "cash" && o.spots > 1;
  const pct = o.type === "cash" && o.goalAmount ? Math.min(100, ((o.meterValue ?? 0) / o.goalAmount) * 100) : 0;
  return (
    <button
      type="button"
      className="gt-ornament"
      data-zone={o.zone}
      data-dim={dim ? "true" : "false"}
      tabIndex={-1}
      aria-hidden="true"
      style={{ left: o.x * UNIT, top: o.y * UNIT, width: px, height: px, fontSize: Math.max(7, px * 0.12) }}
      onClick={onOpen}
    >
      <span className="flex flex-col items-center gap-[3px] w-full">
        <span className="gt-ornament-title">{o.title}</span>
        {showSpots && <span style={{ fontSize: "0.8em" }}>{COPY.spotsLeft(o.spotsLeft, o.spots)}</span>}
        {o.type === "cash" && (
          <span className="gt-meter w-[60%]" style={{ height: Math.max(3, px * 0.05) }}>
            <span style={{ width: `${pct}%` }} />
          </span>
        )}
      </span>
    </button>
  );
}

export default forwardRef<PanZoomHandle, {
  opportunities: PublicOpportunity[];
  orgFilter: string | null;
  onOpen: (o: PublicOpportunity) => void;
  onZone: (zone: OppType) => void;
  overlay?: React.ReactNode;
  /** A list sheet covers the lower part of the view. */
  sheetOpen?: boolean;
}>(function Tree({ opportunities, orgFilter, onOpen, onZone, overlay, sheetOpen }, ref) {
  // Lowest tier first, so each tier above overlaps the one below it.
  const tiers = tierPaths().reverse();
  return (
    <PanZoom ref={ref} width={TREE_W} height={TREE_H} maxFitScale={1.2} className="h-full w-full" label={COPY.treeTitle} overlay={overlay} loose={sheetOpen} controls={false}>
      {(scale) => (
        <>
          <svg width={TREE_W} height={TREE_H} viewBox={`0 0 ${TREE.width} ${TREE.height}`} className="absolute inset-0" aria-hidden="true">
            <rect x={TREE.centerX - 5} y={TREE.trunkTop - 2} width={10} height={TREE.height - TREE.trunkTop + 2} fill="var(--gt-trunk)" />
            {tiers.map((d, i) => (
              <path key={i} d={d} fill="var(--gt-tree)" stroke="var(--gt-tree-edge)" strokeWidth={0.6} strokeLinejoin="round" />
            ))}
            {/* A star on top. */}
            <polygon
              transform={`translate(${TREE.centerX} ${TIERS[0].top + 1})`}
              points={Array.from({ length: 10 }, (_, i) => {
                const r = i % 2 ? 2.2 : 5;
                const a = (Math.PI / 5) * i - Math.PI / 2;
                return `${(r * Math.cos(a)).toFixed(2)},${(r * Math.sin(a)).toFixed(2)}`;
              }).join(" ")}
              fill="var(--gt-accent)"
            />
          </svg>
          {opportunities.map((o) => (
            <Ornament key={o.id} o={o} size={o.size} dim={!!orgFilter && o.orgId !== orgFilter} onOpen={() => onOpen(o)} />
          ))}
          {/* Zone labels: readable when zoomed out, out of the way when zoomed in. */}
          {scale < 1.4 &&
            ZONES.map((z) => (
                <button
                  key={z.key}
                  type="button"
                  className="gt-zone-label"
                  // Each label sits in the clear strip at the top of its zone.
                  style={{ left: TREE.centerX * UNIT, top: (z.y0 + LABEL_ROOM / 2) * UNIT, fontSize: Math.min(48, 14 / scale) }}
                  onClick={() => onZone(z.key)}
                >
                  {COPY.zoneLabels[z.key]}
                </button>
            ))}
        </>
      )}
    </PanZoom>
  );
});
