"use client";

// ─── The tree: "Ways to give" ────────────────────────────────────────────────
// Drawn from data: the outline and zones come from lib/givingTree/layout, each
// ornament sits at the position the server worked out for it.

import { forwardRef } from "react";
import { COPY } from "@/lib/givingTree/copy";
import { TREE, ZONES } from "@/lib/givingTree/layout";
import type { OppType, PublicOpportunity } from "@/lib/givingTree/types";
import PanZoom, { type PanZoomHandle } from "./PanZoom";

/** Tree units (0–100) to content pixels. */
export const UNIT = 10;
export const TREE_PX = 100 * UNIT;

export function ornamentRect(o: PublicOpportunity) {
  const s = o.size * UNIT;
  return { x: o.x * UNIT - s, y: o.y * UNIT - s, w: s * 2, h: s * 2 };
}

export function zoneRect(zone: OppType) {
  const z = ZONES.find((x) => x.key === zone)!;
  const half = TREE.halfBase * ((z.y1 - TREE.apexY) / (TREE.baseY - TREE.apexY));
  return { x: (50 - half) * UNIT, y: z.y0 * UNIT, w: half * 2 * UNIT, h: (z.y1 - z.y0) * UNIT };
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
  const apex = `${TREE.apexX * UNIT},${TREE.apexY * UNIT}`;
  const left = `${(TREE.apexX - TREE.halfBase) * UNIT},${TREE.baseY * UNIT}`;
  const right = `${(TREE.apexX + TREE.halfBase) * UNIT},${TREE.baseY * UNIT}`;
  return (
    <PanZoom ref={ref} width={TREE_PX} height={TREE_PX} maxFitScale={1.2} className="h-full w-full" label={COPY.treeTitle} overlay={overlay} loose={sheetOpen}>
      {(scale) => (
        <>
          <svg width={TREE_PX} height={TREE_PX} className="absolute inset-0" aria-hidden="true">
            <rect x={46 * UNIT} y={TREE.baseY * UNIT} width={8 * UNIT} height={5 * UNIT} fill="var(--gt-trunk)" />
            <polygon points={`${apex} ${right} ${left}`} fill="var(--gt-tree)" stroke="var(--gt-tree-edge)" strokeWidth={6} />
            {ZONES.slice(1).map((z) => {
              const hw = TREE.halfBase * ((z.y0 - TREE.apexY) / (TREE.baseY - TREE.apexY));
              return <line key={z.key} x1={(50 - hw) * UNIT} x2={(50 + hw) * UNIT} y1={z.y0 * UNIT} y2={z.y0 * UNIT} stroke="var(--gt-tree-edge)" strokeWidth={3} strokeDasharray="12 10" />;
            })}
          </svg>
          {opportunities.map((o) => (
            <Ornament key={o.id} o={o} size={o.size} dim={!!orgFilter && o.orgId !== orgFilter} onOpen={() => onOpen(o)} />
          ))}
          {/* Zone labels: readable when zoomed out, out of the way when zoomed in. */}
          {scale < 1.4 &&
            ZONES.map((z) => {
              const hw = TREE.halfBase * ((z.y0 - TREE.apexY) / (TREE.baseY - TREE.apexY));
              const x = z.key === "volunteer" ? 50 : 50 - hw - 2;
              return (
                <button
                  key={z.key}
                  type="button"
                  className="gt-zone-label"
                  style={{ left: x * UNIT, top: (z.key === "volunteer" ? z.y0 - 3 : z.y0 + 2) * UNIT, fontSize: Math.min(56, 18 / scale) }}
                  onClick={() => onZone(z.key)}
                >
                  {COPY.zoneLabels[z.key]}
                </button>
              );
            })}
        </>
      )}
    </PanZoom>
  );
});
