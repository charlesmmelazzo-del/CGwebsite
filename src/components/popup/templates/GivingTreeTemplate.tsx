"use client";

// ─── The Giving Tree (Christmas) ─────────────────────────────────────────────
//
// Two parts: the Christmas recipe downloads (same as the last two pop-ups),
// and the Giving Tree. Guests pick an ornament from a partner charity,
// promise to do it, and their ornament rises into the sky as a star.
//
// Everything is drawn from /api/popup/giving-tree/state. While this pop-up
// is live the tree takes pledges; once another pop-up goes live it shows only
// the sky. In the admin sandbox it also shows the demo data, with a banner.
// See docs/giving-tree-spec.md; the look lives in givingTree/theme.tsx and
// every word in lib/givingTree/copy.ts.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PopupTemplateProps } from "@/lib/popup/types";
import { COPY } from "@/lib/givingTree/copy";
import { starPosition } from "@/lib/givingTree/layout";
import type { OppType, PublicOpportunity, PublicStar, TreeState } from "@/lib/givingTree/types";
import type { ClaimSuccess } from "../givingTree/ClaimForm";
import OrnamentCard from "../givingTree/OrnamentCard";
import type { PanZoomHandle } from "../givingTree/PanZoom";
import Partners from "../givingTree/Partners";
import Recipes from "../givingTree/Recipes";
import Sky from "../givingTree/Sky";
import Success from "../givingTree/Success";
import { GivingTreeStyles } from "../givingTree/theme";
import Tree, { ornamentRect, zoneRect } from "../givingTree/Tree";
import ZoneList from "../givingTree/ZoneList";
import { ZOOM_MS, useReducedMotion } from "../givingTree/motion";

type Screen = "tree" | "sky" | "partners" | "recipes";

export default function GivingTreeTemplate({ cocktails, recordInteraction, isSandbox }: PopupTemplateProps) {
  const [state, setState] = useState<TreeState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [screen, setScreen] = useState<Screen>("tree");
  const [zone, setZone] = useState<OppType | "all" | null>(null);
  const [orgFilter, setOrgFilter] = useState<string | null>(null);
  const [selected, setSelected] = useState<PublicOpportunity | null>(null);
  const [success, setSuccess] = useState<ClaimSuccess | null>(null);
  const [highlight, setHighlight] = useState<string | null>(null);
  const [extraStars, setExtraStars] = useState<PublicStar[]>([]);
  const [partnerFocus, setPartnerFocus] = useState<string | null>(null);
  const tree = useRef<PanZoomHandle>(null);
  const reduced = useReducedMotion();

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/popup/giving-tree/state${isSandbox ? "?sandbox=1" : ""}`, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? COPY.errGeneric);
      setState(data);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : COPY.errGeneric);
    }
  }, [isSandbox]);

  useEffect(() => {
    load();
    const t = window.setInterval(() => document.visibilityState === "visible" && load(), 30_000);
    return () => window.clearInterval(t);
  }, [load]);

  // Screens are history entries, so the phone's back button moves between them.
  const go = useCallback((next: Screen) => {
    setScreen(next);
    window.history.pushState({ ...(window.history.state ?? {}), gt: next }, "");
  }, []);
  useEffect(() => {
    window.history.replaceState({ ...(window.history.state ?? {}), gt: "tree" }, "");
    const onPop = (e: PopStateEvent) => setScreen(((e.state as { gt?: Screen } | null)?.gt ?? "tree") as Screen);
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);
  const back = useCallback(() => window.history.back(), []);

  const orgs = useMemo(() => new Map((state?.orgs ?? []).map((o) => [o.id, o])), [state]);
  const opps = useMemo(() => state?.opportunities ?? [], [state]);
  const openOrgIds = useMemo(() => new Set(opps.map((o) => o.orgId)), [opps]);

  const stars = useMemo(() => {
    const base = state?.stars ?? [];
    const ids = new Set(base.map((s) => s.id));
    // A star the server doesn't show yet (e.g. held for review) still appears
    // for the guest who just made it, for this visit.
    const mine = extraStars.filter((s) => !ids.has(s.id)).map((s, i) => ({ ...s, ...starPosition(base.length + i) }));
    return [...base, ...mine];
  }, [state, extraStars]);

  const listItems = useMemo(
    () => opps.filter((o) => (zone === "all" || o.zone === zone) && (!orgFilter || o.orgId === orgFilter)),
    [opps, zone, orgFilter]
  );

  function openOrnament(o: PublicOpportunity) {
    tree.current?.zoomTo(ornamentRect(o), { maxScale: 3, visible: zone && window.innerWidth < 900 ? 0.45 : 1 });
    window.setTimeout(() => setSelected(o), reduced ? 0 : ZOOM_MS);
  }

  function openZone(z: OppType) {
    setZone(z);
    // On a phone the list covers the lower part of the screen: fit the zone
    // into the part above it.
    tree.current?.zoomTo(zoneRect(z), { visible: window.innerWidth < 900 ? 0.45 : 1 });
  }

  function showPartner(orgId: string | null) {
    setSelected(null);
    setPartnerFocus(orgId);
    go("partners");
  }

  function waysToGive(orgId: string) {
    setOrgFilter(orgId);
    setZone("all");
    go("tree");
  }

  function claimed(s: ClaimSuccess) {
    setSelected(null);
    setSuccess(s);
    setExtraStars((x) => [...x, s.star]);
    void recordInteraction("giving_tree_pledge", { type: s.type });
    load();
  }

  if (error && !state) {
    return (
      <div className="gt-root h-[calc(100dvh-49px)] flex items-center justify-center p-6 text-center">
        <GivingTreeStyles />
        <p>{error}</p>
      </div>
    );
  }
  if (!state) {
    return (
      <div className="gt-root h-[calc(100dvh-49px)]">
        <GivingTreeStyles />
      </div>
    );
  }

  const closed = state.mode === "closed";
  const banner = state.hasDemo && <div className="gt-banner">{COPY.sampleBanner}</div>;
  const partnersButton = (
    <button type="button" className="gt-btn gt-btn-small" onClick={() => showPartner(null)}>
      {COPY.partnersButton}
    </button>
  );
  const recipesButton = (
    <button type="button" className="gt-btn gt-btn-small" onClick={() => go("recipes")}>
      {COPY.recipesButton}
    </button>
  );

  return (
    <div className="gt-root relative h-[calc(100dvh-49px)] overflow-hidden flex flex-col">
      <GivingTreeStyles />
      {banner}
      <div className="relative flex-1 min-h-0">
        {screen === "recipes" && (
          <Recipes cocktails={cocktails} onBack={back} onDownload={(c) => void recordInteraction("recipe_download", { name: c.name }, c.id)} />
        )}

        {screen === "partners" && (
          <Partners orgs={state.orgs} focusId={partnerFocus} openOrgIds={closed ? new Set() : openOrgIds} onBack={back} onWaysToGive={waysToGive} />
        )}

        {(screen === "sky" || (closed && screen === "tree")) && (
          <Sky
            stars={stars}
            counters={state.counters}
            highlight={highlight}
            heading={closed ? COPY.closedTitle : COPY.skyTitle}
            intro={closed ? COPY.closedBody : undefined}
            onBack={closed ? undefined : back}
            actions={
              <div className="flex flex-wrap gap-2">
                {partnersButton}
                {closed && recipesButton}
              </div>
            }
          />
        )}

        {screen === "tree" && !closed && (
          <div className="h-full flex flex-col">
            {/* The sky above the tree: tap it to open the sky. */}
            <button type="button" className="gt-sky text-left px-3 py-2 border-b border-[var(--gt-line)] flex items-center gap-3" onClick={() => go("sky")}>
              <span className="gt-display text-[length:var(--gt-size-l)] shrink-0">{COPY.skyTitle}</span>
              <span className="gt-small gt-muted flex-1 min-w-0 truncate">
                {COPY.neighborsLine(state.counters.neighbors)}
              </span>
              <span className="gt-small underline shrink-0" aria-hidden="true">↑</span>
            </button>

            <h1 className="sr-only">{COPY.treeTitle}</h1>
            {/* Zone chips: the keyboard and screen-reader way into each zone's list. */}
            <div className="px-3 py-2 flex gap-2 overflow-x-auto gt-noscroll" role="group" aria-label={COPY.treeTitle}>
              {(["volunteer", "gift", "cash"] as OppType[]).map((z) => (
                <button key={z} type="button" className="gt-btn gt-btn-small shrink-0" aria-pressed={zone === z} onClick={() => openZone(z)}>
                  {COPY.zoneLabels[z]} ({opps.filter((o) => o.zone === z && (!orgFilter || o.orgId === orgFilter)).length})
                </button>
              ))}
              <span className="shrink-0">{partnersButton}</span>
              <span className="shrink-0">{recipesButton}</span>
            </div>
            {orgFilter && (
              <div className="px-3 pb-2 flex items-center gap-2 gt-small">
                <span>{COPY.filteredTo(orgs.get(orgFilter)?.name ?? "")}</span>
                <button type="button" className="underline" onClick={() => setOrgFilter(null)}>
                  {COPY.clearFilter}
                </button>
              </div>
            )}

            <div className="relative flex-1 min-h-0">
              <Tree ref={tree} opportunities={opps} orgFilter={orgFilter} onOpen={openOrnament} onZone={openZone} />
              {opps.length === 0 && (
                <div className="absolute inset-0 z-20 flex items-center justify-center p-6 bg-black/60">
                  <div className="gt-card p-5 max-w-sm text-center space-y-3">
                    <h2 className="gt-display text-[length:var(--gt-size-xl)]">{COPY.treeFullTitle}</h2>
                    <p>{COPY.treeFullBody}</p>
                    <button type="button" className="gt-btn gt-btn-primary w-full" onClick={() => showPartner(null)}>
                      {COPY.partnersButton}
                    </button>
                  </div>
                </div>
              )}
              {zone && <ZoneList zone={zone} opportunities={listItems} orgs={orgs} onOpen={openOrnament} onClose={() => setZone(null)} />}
            </div>
          </div>
        )}

        {selected && orgs.get(selected.orgId) && (
          <OrnamentCard
            o={selected}
            org={orgs.get(selected.orgId)!}
            today={state.today}
            sandbox={isSandbox}
            contactEmail={state.contactEmail}
            onClose={() => setSelected(null)}
            onOrg={(id) => showPartner(id)}
            onSuccess={claimed}
          />
        )}
        {success && (
          <Success
            s={success}
            onClose={() => setSuccess(null)}
            onSky={() => {
              setHighlight(success.star.id);
              setSuccess(null);
              go("sky");
            }}
          />
        )}
      </div>
    </div>
  );
}
