"use client";

// Pre-publish preview: the real guest screens for one event, inside a phone,
// with a list of every screen to click through. Used by the admin (before
// approving or publishing) and by a brand partner from their private link.
// Fully simulated — nothing is saved, and scores and winners are examples.

import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, Eye } from "lucide-react";
import type { LiveState, PublicEvent, Viewer } from "@/lib/compete/types";
import GuestApp, { type Tab } from "./GuestApp";
import JoinScreen from "./JoinScreen";
import { accentStyle, bartenderName } from "./Profiles";
import { PhoneFrame, usePhoneScale } from "./PhoneFrame";

const GUEST: Viewer = {
  codeId: "preview",
  code: "PREVIEW",
  tierId: "general",
  tierLabel: "General Admission",
  isJudge: false,
  name: "",
};

type Screen = {
  group: string;
  label: string;
  phone: { kind: "join" } | { kind: "app"; state: LiveState; tab: Tab; viewer: Viewer | null; finished?: boolean };
};

const base: LiveState = { phase: "lobby", closed: [], revealed: [] };

function buildScreens(ev: PublicEvent, judges: string[]): Screen[] {
  const screens: Screen[] = [
    { group: "Arrival", label: "Ticket sign-in", phone: { kind: "join" } },
    { group: "Arrival", label: "Welcome screen", phone: { kind: "app", state: base, tab: "live", viewer: GUEST } },
    { group: "Browse", label: "Featured spirit", phone: { kind: "app", state: base, tab: "brand", viewer: GUEST } },
    { group: "Browse", label: "The lineup", phone: { kind: "app", state: base, tab: "lineup", viewer: GUEST } },
    { group: "Browse", label: "At-home recipes", phone: { kind: "app", state: base, tab: "home", viewer: GUEST } },
  ];

  for (const c of ev.contestants) {
    const name = bartenderName(ev.bartenderFields, c.bartender);
    screens.push(
      { group: name, label: "Bartender", phone: { kind: "app", state: { ...base, phase: "contestant", contestantId: c.id, step: "bartender" }, tab: "live", viewer: GUEST } },
      { group: name, label: "Cocktail", phone: { kind: "app", state: { ...base, phase: "contestant", contestantId: c.id, step: "cocktail" }, tab: "live", viewer: GUEST } }
    );
  }

  const first = ev.contestants[0];
  if (first) {
    const example = (judges.length ? judges : ["Judge 1", "Judge 2", "Judge 3"]).map((name, i) => ({
      name,
      scores: Object.fromEntries(ev.scoreCategories.map((cat, k) => [cat.id, 5 - ((i + k) % 2)])),
    }));
    const voting = { ...base, phase: "contestant" as const, contestantId: first.id, step: "voting" as const, judgeVoting: true };
    screens.push(
      { group: "Voting", label: "Judges’ reveal (example scores)", phone: { kind: "app", state: { ...voting, judgeReveal: { contestantId: first.id, judges: example } }, tab: "live", viewer: GUEST } },
      { group: "Voting", label: "Guest ballot", phone: { kind: "app", state: { ...voting, guestVoting: true }, tab: "live", viewer: GUEST } },
      { group: "Voting", label: "Superlatives", phone: { kind: "app", state: { ...base, phase: "superlatives", superlativesOpen: true }, tab: "live", viewer: GUEST } }
    );
    const revealed = [
      ...ev.superlatives.map((s, i) => ({ key: s.id, label: s.label, contestantId: ev.contestants[(i + 1) % ev.contestants.length].id })),
      { key: "overall", label: "Overall Winner", contestantId: first.id },
    ];
    screens.push(
      { group: "Results", label: "Winners reveal (example)", phone: { kind: "app", state: { ...base, phase: "reveal", revealed }, tab: "live", viewer: GUEST } },
      { group: "Results", label: "After the event (public recap)", phone: { kind: "app", state: { ...base, phase: "finished", revealed }, tab: "live", viewer: null, finished: true } }
    );
  }
  return screens;
}

export default function EventPreview({
  ev,
  judges,
  audience,
  backHref,
  backLabel,
}: {
  ev: PublicEvent;
  judges: string[];
  audience: "admin" | "partner";
  backHref?: string;
  backLabel?: string;
}) {
  const screens = useMemo(() => buildScreens(ev, judges), [ev, judges]);
  const [i, setI] = useState(0);
  const scale = usePhoneScale();
  const screen = screens[i];
  const go = (n: number) => setI(Math.max(0, Math.min(screens.length - 1, n)));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest("input, textarea")) return;
      if (e.key === "ArrowRight" || e.key === "ArrowDown") go(i + 1);
      if (e.key === "ArrowLeft" || e.key === "ArrowUp") go(i - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const groups = screens.reduce<{ group: string; items: { s: Screen; n: number }[] }[]>((acc, s, n) => {
    const last = acc[acc.length - 1];
    if (last && last.group === s.group) last.items.push({ s, n });
    else acc.push({ group: s.group, items: [{ s, n }] });
    return acc;
  }, []);

  const phone = screen.phone;
  const shownEv: PublicEvent = phone.kind === "app" && phone.finished ? { ...ev, status: "finished" } : ev;

  return (
    <div className="cmp min-h-[100dvh] flex flex-col" style={accentStyle(ev.accentColor)}>
      <header className="shrink-0 border-b border-[var(--cmp-line)] px-5 py-3 flex flex-wrap items-center gap-x-6 gap-y-2">
        <div className="flex items-center gap-2 text-[var(--cmp-accent)]">
          <Eye size={16} />
          <span className="cmp-label">Preview</span>
        </div>
        <div className="cmp-display text-xl">{ev.name}</div>
        <span className="text-[10px] tracking-[0.18em] uppercase border border-[var(--cmp-line)] px-2 py-1 cmp-muted">
          {ev.status === "draft" ? "Not published yet" : ev.status}
        </span>
        <span className="text-xs cmp-faint">
          {audience === "admin"
            ? "Includes submissions you haven’t approved yet. Nothing here is saved; scores and winners are examples."
            : "This is how guests will see your brand on the night. Nothing here is saved; scores and winners are examples."}
        </span>
        {backHref && (
          <a href={backHref} className="ml-auto text-xs tracking-[0.16em] uppercase cmp-muted hover:text-[var(--cmp-text)]">
            ← {backLabel ?? "Back"}
          </a>
        )}
      </header>

      {/* Phone-width screens: chips across the top instead of the side list. */}
      <div className="lg:hidden flex gap-2 overflow-x-auto cmp-scroll-x px-4 py-3 border-b border-[var(--cmp-line)]">
        {screens.map((s, n) => (
          <button
            key={n}
            onClick={() => go(n)}
            className="shrink-0 text-[11px] tracking-[0.1em] px-3 py-2 border whitespace-nowrap"
            style={{ borderColor: n === i ? "var(--cmp-accent)" : "var(--cmp-line)", color: n === i ? "var(--cmp-accent)" : "var(--cmp-muted)" }}
          >
            {s.group === s.label || s.group === "Arrival" || s.group === "Browse" || s.group === "Voting" || s.group === "Results" ? s.label : `${s.group} · ${s.label}`}
          </button>
        ))}
      </div>

      <main className="flex-1 mx-auto w-full max-w-6xl px-4 py-6 lg:py-8 grid lg:grid-cols-[280px_minmax(0,1fr)] gap-8 items-start">
        <nav className="hidden lg:block sticky top-6 max-h-[calc(100dvh-120px)] overflow-y-auto cmp-scroll-x pr-2">
          {groups.map((g) => (
            <div key={g.group + g.items[0].n} className="mb-5">
              <div className="cmp-label !text-[10px] mb-2">{g.group}</div>
              {g.items.map(({ s, n }) => (
                <button
                  key={n}
                  onClick={() => go(n)}
                  className="block w-full text-left text-sm py-1.5 pl-3 border-l-2 transition-colors"
                  style={{
                    borderColor: n === i ? "var(--cmp-accent)" : "transparent",
                    color: n === i ? "var(--cmp-text)" : "var(--cmp-muted)",
                  }}
                >
                  {s.label}
                </button>
              ))}
            </div>
          ))}
          {ev.contestants.length === 0 && (
            <p className="text-xs cmp-faint leading-relaxed">
              Bartender and voting screens appear here once contestants have filled in their details.
            </p>
          )}
        </nav>

        <div className="flex flex-col items-center">
          <PhoneFrame scale={scale}>
            {phone.kind === "join" ? (
              <JoinScreen ev={ev} initialCode="ABC123" onSimJoin={() => go(i + 1)} />
            ) : (
              <GuestApp
                ev={shownEv}
                initialLive={{ version: 0, state: phone.state, status: shownEv.status }}
                viewer={phone.viewer}
                sim={{ state: phone.state, tab: phone.tab, step: i }}
              />
            )}
          </PhoneFrame>
          <div className="mt-5 flex items-center gap-3">
            <button onClick={() => go(i - 1)} disabled={i === 0} className="cmp-btn-ghost !px-4" aria-label="Previous screen">
              <ArrowLeft size={16} />
            </button>
            <span className="text-xs cmp-muted tabular-nums min-w-[180px] text-center">
              {screen.group !== screen.label && !["Arrival", "Browse", "Voting", "Results"].includes(screen.group) ? `${screen.group} · ` : ""}
              {screen.label}
            </span>
            <button onClick={() => go(i + 1)} disabled={i === screens.length - 1} className="cmp-btn-ghost !px-4" aria-label="Next screen">
              <ArrowRight size={16} />
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
