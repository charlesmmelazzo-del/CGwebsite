"use client";

// ─── Admin → Pop Ups → Giving Tree ───────────────────────────────────────────
// Everything for running the Giving Tree, phone-first: check-in at the bar
// is the first thing on the screen.

import { useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { CashSection, CheckInSection, OrnamentsSection, PledgesSection, ReviewSection } from "@/components/admin/givingTree/Pledges";
import { ManualSection, OppsSection, OrgsSection } from "@/components/admin/givingTree/Setup";
import { DemoSection, ExportsSection, ImportSection, SettingsSection } from "@/components/admin/givingTree/Tools";
import type { Act, Snapshot } from "@/components/admin/givingTree/kit";

const SECTIONS = [
  ["checkin", "Check in"],
  ["review", "Needs review"],
  ["pledges", "Pledges"],
  ["manual", "Add a pledge"],
  ["ornaments", "Ornaments to write"],
  ["opps", "Opportunities"],
  ["orgs", "Organizations"],
  ["cash", "Cash check"],
  ["import", "Import"],
  ["exports", "Exports"],
  ["settings", "Settings"],
  ["demo", "Demo & season"],
] as const;
type Section = (typeof SECTIONS)[number][0];

export default function GivingTreeAdminPage() {
  const [s, setS] = useState<Snapshot | null>(null);
  const [section, setSection] = useState<Section>("checkin");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/giving-tree", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not load.");
      setS(data);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load.");
    }
  }, []);

  useEffect(() => {
    load();
    const fromHash = window.location.hash.slice(1) as Section;
    if (SECTIONS.some(([k]) => k === fromHash)) setSection(fromHash);
  }, [load]);

  const act: Act = useCallback(
    async (body, opts) => {
      const res = await fetch("/api/admin/giving-tree", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed.");
      if (opts?.reload !== false) await load();
      return data;
    },
    [load]
  );

  function pick(k: Section) {
    setSection(k);
    window.history.replaceState(null, "", `#${k}`);
  }

  const reviewCount = s ? s.pledges.filter((p) => p.hold === "held_moderation" || p.hold === "held_amount" || p.overdue).length : 0;

  return (
    <div className="max-w-3xl space-y-4">
      <header>
        <h1 className="text-lg text-gray-800">Giving Tree</h1>
        <p className="mt-1 text-xs text-gray-400 leading-relaxed">
          The Christmas pop-up&rsquo;s partner organizations, ways to give, and pledges. The pop-up itself (and its recipes) is edited from the Pop Ups list.
        </p>
      </header>

      {s?.hasDemo && (
        <div className="px-3 py-2 bg-amber-50 border border-amber-200 text-xs text-amber-800">
          Demo data is loaded. It only shows in the sandbox, and the Christmas pop-up can&rsquo;t go live until it&rsquo;s wiped (Demo &amp; season).
        </div>
      )}

      <nav className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1" aria-label="Giving Tree sections">
        {SECTIONS.map(([k, label]) => (
          <button
            key={k}
            type="button"
            onClick={() => pick(k)}
            aria-current={section === k ? "page" : undefined}
            className={`shrink-0 min-h-[40px] px-3 text-xs border ${section === k ? "bg-gray-800 text-white border-gray-800" : "bg-white text-gray-600 border-gray-300"}`}
          >
            {label}
            {k === "review" && reviewCount > 0 ? ` (${reviewCount})` : ""}
          </button>
        ))}
      </nav>

      {error && <div className="px-3 py-2 bg-red-50 border border-red-200 text-xs text-red-700">{error}</div>}

      {!s ? (
        !error && (
          <div className="flex items-center gap-2 text-sm text-gray-400 py-12 justify-center">
            <Loader2 size={16} className="animate-spin" /> Loading…
          </div>
        )
      ) : (
        <>
          {section === "checkin" && <CheckInSection s={s} act={act} onAddManual={() => pick("manual")} />}
          {section === "review" && <ReviewSection s={s} act={act} />}
          {section === "pledges" && <PledgesSection s={s} act={act} />}
          {section === "manual" && <ManualSection s={s} act={act} />}
          {section === "ornaments" && <OrnamentsSection s={s} act={act} />}
          {section === "opps" && <OppsSection s={s} act={act} />}
          {section === "orgs" && <OrgsSection s={s} act={act} />}
          {section === "cash" && <CashSection s={s} act={act} />}
          {section === "import" && <ImportSection act={act} />}
          {section === "exports" && <ExportsSection s={s} />}
          {section === "settings" && <SettingsSection s={s} act={act} />}
          {section === "demo" && <DemoSection s={s} act={act} />}
        </>
      )}
    </div>
  );
}
