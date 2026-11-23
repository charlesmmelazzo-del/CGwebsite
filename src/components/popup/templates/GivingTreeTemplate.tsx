"use client";

// ─── The Giving Tree (Christmas) ─────────────────────────────────────────────
//
// Opens with three panels written out in script, then a home screen with two
// ways in: the Christmas recipe downloads (same as the last two pop-ups) and
// the Giving Tree. On the tree guests pick an ornament from a partner
// charity and promise to do it; their stocking is then hung under "What
// we've given". The two are tabs along the bottom.
//
// Everything is drawn from /api/popup/giving-tree/state. While this pop-up
// is live the tree takes pledges; once another pop-up goes live only "What
// we've given" remains. In the admin sandbox it also shows the demo data,
// with a banner.
// See docs/giving-tree-spec.md; the look lives in givingTree/theme.tsx and
// every word in lib/givingTree/copy.ts.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PopupTemplateProps } from "@/lib/popup/types";
import { COPY } from "@/lib/givingTree/copy";
import type { OppType, PublicOpportunity, PublicStar, TreeState } from "@/lib/givingTree/types";
import type { ClaimSuccess } from "../givingTree/ClaimForm";
import OrnamentCard from "../givingTree/OrnamentCard";
import type { PanZoomHandle } from "../givingTree/PanZoom";
import Given from "../givingTree/Given";
import Intro from "../givingTree/Intro";
import Partners from "../givingTree/Partners";
import Recipes from "../givingTree/Recipes";
import { GivingTreeStyles } from "../givingTree/theme";
import Tree, { ornamentRect, zoneRect } from "../givingTree/Tree";
import ZoneList from "../givingTree/ZoneList";
import { ZOOM_MS, useReducedMotion } from "../givingTree/motion";

type Screen = "home" | "tree" | "given" | "partners" | "recipes";

/** The opening plays once per visit (per browser tab). */
const INTRO_SEEN = "gt-intro-seen";
function introSeen(): boolean {
  try {
    return window.sessionStorage.getItem(INTRO_SEEN) === "1";
  } catch {
    return false;
  }
}

export default function GivingTreeTemplate({ cocktails, recordInteraction, isSandbox }: PopupTemplateProps) {
  const [state, setState] = useState<TreeState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [screen, setScreen] = useState<Screen>("home");
  const [intro, setIntro] = useState<boolean | null>(null);
  const [zone, setZone] = useState<OppType | "all" | null>(null);
  const [orgFilter, setOrgFilter] = useState<string | null>(null);
  const [selected, setSelected] = useState<PublicOpportunity | null>(null);
  const [success, setSuccess] = useState<ClaimSuccess | null>(null);
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

  useEffect(() => setIntro(!introSeen()), []);
  const endIntro = useCallback(() => {
    try {
      window.sessionStorage.setItem(INTRO_SEEN, "1");
    } catch {
      /* private browsing: it just plays again next time */
    }
    setIntro(false);
  }, []);

  // Screens are history entries, so the phone's back button moves between
  // them. Switching tabs replaces the entry, so Back from either tab goes home.
  const go = useCallback((next: Screen, opts?: { replace?: boolean }) => {
    setScreen(next);
    const entry = { ...(window.history.state ?? {}), gt: next };
    if (opts?.replace) window.history.replaceState(entry, "");
    else window.history.pushState(entry, "");
  }, []);
  useEffect(() => {
    window.history.replaceState({ ...(window.history.state ?? {}), gt: "home" }, "");
    const onPop = (e: PopStateEvent) => setScreen(((e.state as { gt?: Screen } | null)?.gt ?? "home") as Screen);
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);
  const back = useCallback(() => window.history.back(), []);

  const orgs = useMemo(() => new Map((state?.orgs ?? []).map((o) => [o.id, o])), [state]);
  const opps = useMemo(() => state?.opportunities ?? [], [state]);
  const openOrgIds = useMemo(() => new Set(opps.map((o) => o.orgId)), [opps]);

  const stockings = useMemo(() => {
    const base = state?.stars ?? [];
    const ids = new Set(base.map((s) => s.id));
    // A stocking the server doesn't show yet (e.g. held for review) still
    // appears for the guest who just hung it, for this visit.
    return [...base, ...extraStars.filter((s) => !ids.has(s.id))];
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
    setZone(null);
    setSuccess(s);
    setExtraStars((x) => [...x, s.star]);
    go("given", { replace: true });
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
  const homeButton = (
    <button type="button" className="gt-btn gt-btn-small" onClick={() => go("home")}>
      ← {COPY.home}
    </button>
  );
  // While closed there is no tree: "What we've given" stands alone.
  const tab = screen === "tree" && !closed ? "tree" : screen === "given" || (screen === "tree" && closed) ? "given" : null;

  return (
    <div className="gt-root relative h-[calc(100dvh-49px)] overflow-hidden flex flex-col">
      <GivingTreeStyles />
      {intro && <Intro onDone={endIntro} />}
      {intro === null && <div className="gt-intro" aria-hidden="true" />}
      {banner}
      <div className="relative flex-1 min-h-0">
        {screen === "home" && (
          <div className="gt-home">
            {/* eslint-disable-next-line @next/next/no-img-element -- placeholder until the Christmas art is in */}
            <img src="/images/logo/logo.svg" alt="Common Good" className="w-40 h-40 opacity-90" />
            <div className="gt-home-actions">
              <button type="button" className="gt-btn gt-btn-primary" onClick={() => go("recipes")}>
                {COPY.homeRecipes}
              </button>
              <button type="button" className="gt-btn" onClick={() => go(closed ? "given" : "tree")}>
                {closed ? COPY.homeGiven : COPY.homeTree}
              </button>
            </div>
          </div>
        )}

        {screen === "recipes" && (
          <Recipes cocktails={cocktails} onBack={back} onDownload={(c) => void recordInteraction("recipe_download", { name: c.name }, c.id)} />
        )}

        {screen === "partners" && (
          <Partners orgs={state.orgs} focusId={partnerFocus} openOrgIds={closed ? new Set() : openOrgIds} onBack={back} onWaysToGive={waysToGive} />
        )}

        {tab === "given" && (
          <Given
            stockings={stockings}
            counters={state.counters}
            heading={closed ? COPY.closedTitle : COPY.skyTitle}
            intro={closed ? COPY.closedBody : undefined}
            mine={success}
            onDismissMine={() => setSuccess(null)}
            actions={
              <div className="flex flex-wrap gap-2">
                {homeButton}
                {partnersButton}
              </div>
            }
          />
        )}

        {tab === "tree" && (
          <div className="h-full flex flex-col">
            <h1 className="sr-only">{COPY.treeTitle}</h1>
            {/* Zone chips: the keyboard and screen-reader way into each zone's list. */}
            <div className="px-3 py-2 flex gap-2 overflow-x-auto gt-noscroll" role="group" aria-label={COPY.treeTitle}>
              <span className="shrink-0">{homeButton}</span>
              {(["volunteer", "gift", "cash"] as OppType[]).map((z) => (
                <button key={z} type="button" className="gt-btn gt-btn-small shrink-0" aria-pressed={zone === z} onClick={() => openZone(z)}>
                  {COPY.zoneLabels[z]} ({opps.filter((o) => o.zone === z && (!orgFilter || o.orgId === orgFilter)).length})
                </button>
              ))}
              <span className="shrink-0">{partnersButton}</span>
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
              <Tree ref={tree} opportunities={opps} orgFilter={orgFilter} onOpen={openOrnament} onZone={openZone} sheetOpen={zone !== null} />
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
      </div>

      {tab && !closed && (
        <nav className="gt-tabs" aria-label={COPY.popupTitle}>
          <button type="button" className="gt-tab" aria-current={tab === "tree" ? "page" : undefined} onClick={() => go("tree", { replace: true })}>
            {COPY.tabTree}
          </button>
          <button type="button" className="gt-tab" aria-current={tab === "given" ? "page" : undefined} onClick={() => go("given", { replace: true })}>
            {COPY.tabGiven}
          </button>
        </nav>
      )}
    </div>
  );
}
