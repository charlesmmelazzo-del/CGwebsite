"use client";

// The guest's phone for the night.
//
// Four tabs — Live, Lineup, Brand, At Home. "Live" follows the host: whenever
// the host moves the show on, every phone jumps back to it. Guests can still
// wander off to read about other contestants or the brand between moments.
//
// It also runs in "sim" mode for the partner showcase (/compete/showcase):
// the showcase drives the state, nothing polls, and votes stay on the page.

import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Radio, Users, Sparkles, BookOpen, X, Check, Loader2, LogOut } from "lucide-react";
import { formatEventDate } from "@/lib/compete/defaults";
import { RichText } from "@/lib/compete/richtext";
import type { LiveState, PublicContestant, PublicEvent, Viewer } from "@/lib/compete/types";
import {
  accentStyle,
  BartenderView,
  BrandView,
  bartenderBar,
  bartenderName,
  brandLogos,
  CocktailPlaceholder,
  CocktailView,
  cocktailName,
  LogoLockup,
  Monogram,
  RecipeList,
} from "./Profiles";
import { JudgeReveal, StarRow, useLive, WinnerCard } from "./live";

export type Tab = "live" | "lineup" | "brand" | "home";

/** True inside the partner showcase: no network, nothing saved. */
const SimContext = createContext(false);

/** Scroll the guest app to the top — the window, or the showcase's phone frame. */
function toTop(el: HTMLElement | null, smooth = false) {
  const frame = el?.closest("[data-phone-scroller]");
  if (frame) frame.scrollTo({ top: 0, behavior: smooth ? "smooth" : "auto" });
  else window.scrollTo({ top: 0, behavior: smooth ? "smooth" : "auto" });
}

export default function GuestApp({
  ev,
  initialLive,
  viewer,
  sim,
}: {
  ev: PublicEvent;
  initialLive: { version: number; state: LiveState; status: string };
  /** Null on a finished event's public recap. */
  viewer: Viewer | null;
  /** Showcase mode: the state and tab to show, set by the showcase. */
  sim?: { state: LiveState; tab: Tab; step: number };
}) {
  const recap = !viewer;
  const live = useLive(ev.slug, initialLive, !sim);
  const s = sim ? sim.state : live.state;
  const root = useRef<HTMLDivElement>(null);
  const [tab, setTab] = useState<Tab>("live");
  const [detail, setDetail] = useState<string | null>(null);
  const [votes, setVotes] = useState<Record<string, Record<string, number>>>({});
  const [picks, setPicks] = useState<Record<string, string>>({});

  const primary = ev.sponsors[0];
  const logos = brandLogos(ev.sponsors);
  const byId = useMemo(() => new Map(ev.contestants.map((c) => [c.id, c])), [ev.contestants]);

  // My own ballots, so a changed mind starts from what I already gave.
  useEffect(() => {
    if (recap || sim) return;
    fetch(`/api/compete/${ev.slug}/me`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d) return;
        setVotes(d.votes ?? {});
        setPicks(d.picks ?? {});
      })
      .catch(() => {});
  }, [ev.slug, recap, sim]);

  // Showcase: each step sets the tab and starts at the top.
  const simStep = sim?.step;
  const simTab = sim?.tab;
  useEffect(() => {
    if (simStep === undefined || !simTab) return;
    setTab(simTab);
    setDetail(null);
    toTop(root.current);
  }, [simStep, simTab]);

  // Follow the host: any move in the show brings everyone back to Live.
  const showKey = [
    s.phase,
    s.contestantId,
    s.step,
    s.judgeReveal ? "j" : "",
    s.revealed?.length ?? 0,
    s.guestVoting ? "g" : "",
    s.judgeVoting ? "v" : "",
    s.superlativesOpen ? "s" : "",
  ].join("|");
  const firstKey = useRef(showKey);
  useEffect(() => {
    if (showKey === firstKey.current) return;
    firstKey.current = showKey;
    if (sim) return; // the showcase picks the tab itself
    setTab("live");
    setDetail(null);
    toTop(root.current, true);
  }, [showKey, sim]);

  const go = (t: Tab) => {
    setTab(t);
    setDetail(null);
    toTop(root.current);
  };

  const detailC = detail ? byId.get(detail) : undefined;

  return (
    <SimContext.Provider value={Boolean(sim)}>
    <div ref={root} className="cmp" style={accentStyle(ev.accentColor)}>
      <div className="mx-auto max-w-md min-h-[100dvh] pb-24 border-x border-[var(--cmp-line)]/50">
        {/* Header */}
        <header className="sticky top-0 z-30 bg-[var(--cmp-bg)]/95 backdrop-blur border-b border-[var(--cmp-line)] px-4 h-14 flex items-center justify-between">
          <LogoLockup cgLogo={ev.commonGoodLogo} brandLogos={logos.slice(0, 2)} size="sm" />
          {viewer && <ViewerBadge viewer={viewer} slug={ev.slug} />}
          {recap && <span className="cmp-label !text-[10px]">Past Competition</span>}
        </header>

        {tab === "live" && (
          <LiveScreen
            ev={ev}
            s={s}
            byId={byId}
            viewer={viewer}
            votes={votes}
            setVotes={setVotes}
            picks={picks}
            setPicks={setPicks}
            onOpen={setDetail}
            go={go}
            recap={recap}
          />
        )}

        {tab === "lineup" && (
          <section className="px-5 pt-8">
            <div className="text-center">
              <div className="cmp-label">The Lineup</div>
              <h2 className="cmp-display text-4xl mt-3">Tonight’s Bartenders</h2>
            </div>
            <ul className="mt-8 divide-y divide-[var(--cmp-line)] border-y border-[var(--cmp-line)]">
              {ev.contestants.map((c, i) => (
                <li key={c.id}>
                  <ContestantRow ev={ev} c={c} index={i} onOpen={() => setDetail(c.id)} live={s.contestantId === c.id} />
                </li>
              ))}
            </ul>
          </section>
        )}

        {tab === "brand" &&
          (primary ? (
            <div className="space-y-16">
              {ev.sponsors.map((sp) => (
                <BrandView key={sp.id} profile={sp.profile} hasRecipes={ev.recipes.length > 0} onRecipes={() => go("home")} />
              ))}
            </div>
          ) : (
            <p className="p-10 text-center cmp-muted">Brand details are coming soon.</p>
          ))}

        {tab === "home" && (
          <RecipeList
            recipes={ev.recipes}
            spirit={ev.featuredSpirit}
            eventName={ev.name}
            cgLogo={ev.commonGoodLogo}
            brandLogo={logos[0]}
            accent={ev.accentColor}
          />
        )}

        <footer className="mt-16 px-5 text-center">
          <div className="cmp-rule mx-auto w-16" />
          <p className="mt-6 text-[11px] tracking-[0.2em] uppercase cmp-faint">Common Good Cocktail House · Glen Ellyn</p>
        </footer>
      </div>

      {/* Contestant detail sheet */}
      {detailC && (
        <div className="fixed inset-0 z-40 bg-[var(--cmp-bg)] overflow-y-auto">
          <div className="mx-auto max-w-md pb-28">
            <div className="sticky top-0 z-10 h-14 flex items-center justify-end px-3 bg-gradient-to-b from-[var(--cmp-bg)] to-transparent">
              <button onClick={() => setDetail(null)} className="p-3" aria-label="Close">
                <X size={22} />
              </button>
            </div>
            <div className="-mt-14">
              <BartenderView fields={ev.bartenderFields} answers={detailC.bartender} eyebrow="The Bartender" />
              <div className="cmp-rule mx-5 my-10" />
              <CocktailView
                fields={ev.cocktailFields}
                answers={detailC.cocktail}
                eyebrow="The Cocktail"
                byline={`by ${bartenderName(ev.bartenderFields, detailC.bartender)}`}
              />
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <nav className="fixed bottom-0 inset-x-0 z-50 bg-[var(--cmp-bg)]/95 backdrop-blur border-t border-[var(--cmp-line)]">
        <div className="mx-auto max-w-md grid grid-cols-4" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
          {(
            [
              ["live", recap ? "Winners" : "Live", Radio],
              ["lineup", "Lineup", Users],
              ["brand", "Spirit", Sparkles],
              ["home", "At Home", BookOpen],
            ] as const
          ).map(([id, label, Icon]) => {
            const on = tab === id && !detail;
            return (
              <button
                key={id}
                onClick={() => go(id)}
                className="h-16 flex flex-col items-center justify-center gap-1.5"
                style={{ color: on ? "var(--cmp-accent)" : "var(--cmp-muted)" }}
              >
                <span className="relative">
                  <Icon size={18} strokeWidth={1.5} />
                  {id === "live" && !recap && s.phase !== "lobby" && s.phase !== "finished" && (
                    <span className="absolute -top-0.5 -right-1.5 w-1.5 h-1.5 rounded-full bg-[var(--cmp-accent)] cmp-pulse" />
                  )}
                </span>
                <span className="text-[10px] tracking-[0.18em] uppercase">{label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
    </SimContext.Provider>
  );
}

function ViewerBadge({ viewer, slug }: { viewer: Viewer; slug: string }) {
  const [open, setOpen] = useState(false);
  const demo = useContext(SimContext);
  return (
    <div className="relative">
      <button onClick={() => setOpen((o) => !o)} className="text-[10px] tracking-[0.18em] uppercase cmp-muted border border-[var(--cmp-line)] px-2.5 py-1.5">
        {viewer.isJudge ? `Judge${viewer.name ? ` · ${viewer.name.split(" ")[0]}` : ""}` : viewer.tierLabel}
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-2 w-56 cmp-card p-4 text-sm z-50">
          <p className="cmp-muted">
            Signed in with ticket <span className="text-[var(--cmp-text)] tracking-widest">{viewer.code}</span>
          </p>
          <button
            className="mt-3 flex items-center gap-2 text-xs tracking-[0.16em] uppercase cmp-muted"
            onClick={async () => {
              if (demo) return setOpen(false);
              await fetch(`/api/compete/${slug}/me`, { method: "DELETE" });
              window.location.reload();
            }}
          >
            <LogOut size={13} /> Sign out of this phone
          </button>
        </div>
      )}
    </div>
  );
}

function ContestantRow({
  ev,
  c,
  index,
  onOpen,
  live,
}: {
  ev: PublicEvent;
  c: PublicContestant;
  index: number;
  onOpen: () => void;
  live?: boolean;
}) {
  const name = bartenderName(ev.bartenderFields, c.bartender);
  return (
    <button onClick={onOpen} className="w-full flex items-center gap-4 py-4 text-left">
      <span className="w-6 text-xs cmp-faint tabular-nums">{String(index + 1).padStart(2, "0")}</span>
      {c.bartender.photoUrl ? (
        <img src={c.bartender.photoUrl} alt="" className="w-14 h-14 object-cover" />
      ) : (
        <Monogram name={name} className="w-14 h-14 text-sm" />
      )}
      <span className="min-w-0 flex-1">
        <span className="block cmp-display text-xl truncate">{name}</span>
        <span className="block text-xs tracking-[0.14em] uppercase cmp-muted truncate">
          {bartenderBar(ev.bartenderFields, c.bartender)}
        </span>
        <span className="block mt-1 text-sm italic cmp-faint truncate">“{cocktailName(ev.cocktailFields, c.cocktail)}”</span>
      </span>
      {live && <span className="cmp-label !text-[9px] cmp-pulse">Live</span>}
    </button>
  );
}

// ─── Live screen ─────────────────────────────────────────────────────────────

function LiveScreen({
  ev,
  s,
  byId,
  viewer,
  votes,
  setVotes,
  picks,
  setPicks,
  onOpen,
  go,
  recap,
}: {
  ev: PublicEvent;
  s: LiveState;
  byId: Map<string, PublicContestant>;
  viewer: Viewer | null;
  votes: Record<string, Record<string, number>>;
  setVotes: (fn: (v: Record<string, Record<string, number>>) => Record<string, Record<string, number>>) => void;
  picks: Record<string, string>;
  setPicks: (fn: (v: Record<string, string>) => Record<string, string>) => void;
  onOpen: (id: string) => void;
  go: (t: Tab) => void;
  recap: boolean;
}) {
  const c = s.contestantId ? byId.get(s.contestantId) : undefined;
  const position = c ? ev.contestants.findIndex((x) => x.id === c.id) + 1 : 0;
  const eyebrow = c ? `Now Presenting · ${position} of ${ev.contestants.length}` : "";

  if (s.phase === "reveal" || s.phase === "finished" || recap) {
    return <WinnersScreen ev={ev} s={s} byId={byId} go={go} />;
  }

  if (s.phase === "superlatives") {
    return <SuperlativesScreen ev={ev} s={s} picks={picks} setPicks={setPicks} />;
  }

  if (s.phase === "contestant" && c) {
    const name = bartenderName(ev.bartenderFields, c.bartender);
    if (s.step === "bartender") {
      return (
        <div className="cmp-rise" key={`b-${c.id}`}>
          <BartenderView fields={ev.bartenderFields} answers={c.bartender} eyebrow={eyebrow} />
        </div>
      );
    }
    if (s.step === "cocktail") {
      return (
        <div className="cmp-rise" key={`c-${c.id}`}>
          <CocktailView
            fields={ev.cocktailFields}
            answers={c.cocktail}
            eyebrow={eyebrow}
            byline={`by ${name} · ${bartenderBar(ev.bartenderFields, c.bartender)}`}
          />
        </div>
      );
    }
    return (
      <VotingScreen
        key={c.id}
        ev={ev}
        s={s}
        c={c}
        viewer={viewer}
        votes={votes}
        setVotes={setVotes}
        onOpen={() => onOpen(c.id)}
      />
    );
  }

  // Lobby
  return (
    <div className="cmp-rise">
      <div className="px-6 pt-14 pb-10 text-center">
        <LogoLockup cgLogo={ev.commonGoodLogo} brandLogos={brandLogos(ev.sponsors).slice(0, 1)} size="lg" />
        <div className="cmp-label mt-12">Common Good Presents</div>
        <h1 className="cmp-display text-5xl mt-4">{ev.name}</h1>
        {ev.featuredSpirit && <p className="mt-4 italic cmp-muted">featuring {ev.featuredSpirit}</p>}
        <p className="mt-6 text-xs tracking-[0.2em] uppercase cmp-faint">
          {formatEventDate(ev.eventDate)}
          {ev.startTime ? ` · ${ev.startTime}` : ""}
        </p>
        {ev.intro && <RichText text={ev.intro} className="cmp-prose mt-8" />}
      </div>
      <div className="mx-5 cmp-card p-5 text-center">
        <span className="inline-block w-1.5 h-1.5 rounded-full bg-[var(--cmp-accent)] cmp-pulse mr-2 align-middle" />
        <span className="text-sm cmp-muted align-middle">The competition begins shortly. Your screen will follow along.</span>
      </div>
      <div className="px-5 mt-10 grid grid-cols-2 gap-3">
        <button className="cmp-btn-ghost" onClick={() => go("lineup")}>
          The Lineup
        </button>
        <button className="cmp-btn-ghost" onClick={() => go("brand")}>
          The Spirit
        </button>
      </div>
      <section className="px-5 mt-12">
        <h3 className="cmp-label mb-2">Tonight’s Bartenders</h3>
        <ul className="divide-y divide-[var(--cmp-line)] border-y border-[var(--cmp-line)]">
          {ev.contestants.map((x, i) => (
            <li key={x.id}>
              <ContestantRow ev={ev} c={x} index={i} onOpen={() => onOpen(x.id)} />
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function VotingScreen({
  ev,
  s,
  c,
  viewer,
  votes,
  setVotes,
  onOpen,
}: {
  ev: PublicEvent;
  s: LiveState;
  c: PublicContestant;
  viewer: Viewer | null;
  votes: Record<string, Record<string, number>>;
  setVotes: (fn: (v: Record<string, Record<string, number>>) => Record<string, Record<string, number>>) => void;
  onOpen: () => void;
}) {
  const closed = (s.closed ?? []).includes(c.id);
  const open = !closed && (viewer?.isJudge ? s.judgeVoting : s.guestVoting);
  const mine = votes[c.id];
  const [draft, setDraft] = useState<Record<string, number>>(mine ?? {});
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const showJudges = s.judgeReveal && s.judgeReveal.contestantId === c.id;

  useEffect(() => {
    if (mine) setDraft(mine);
  }, [mine]);

  const complete = ev.scoreCategories.every((cat) => draft[cat.id] >= 1);
  const changed = JSON.stringify(draft) !== JSON.stringify(mine ?? {});

  const demo = useContext(SimContext);

  async function submit() {
    if (demo) {
      setVotes((v) => ({ ...v, [c.id]: draft }));
      setMsg({ ok: true, text: "Your score is in. You can change it until voting closes." });
      return;
    }
    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/compete/${ev.slug}/vote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contestantId: c.id, scores: draft }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      setVotes((v) => ({ ...v, [c.id]: d.scores }));
      setMsg({ ok: true, text: "Your score is in. You can change it until voting closes." });
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message || "That didn’t save. Please try again." });
    } finally {
      setSaving(false);
    }
  }

  const name = bartenderName(ev.bartenderFields, c.bartender);
  const drink = cocktailName(ev.cocktailFields, c.cocktail);
  const ballotFirst = Boolean(open && viewer && !mine);
  const judgesBlock = (
    <section className="mt-10">
      <h3 className="cmp-label text-center mb-4">The Judges’ Scores</h3>
      <JudgeReveal judges={s.judgeReveal?.judges ?? []} categories={ev.scoreCategories} />
    </section>
  );

  return (
    <div className="px-5 pt-8 cmp-rise" key={`v-${c.id}`}>
      <button onClick={onOpen} className="w-full flex items-center gap-4 text-left">
        {c.cocktail.photoUrl ? (
          <img src={c.cocktail.photoUrl} alt="" className="w-16 h-16 object-cover" />
        ) : (
          <CocktailPlaceholder className="w-16 h-16" />
        )}
        <span>
          <span className="cmp-label block">Now Scoring</span>
          <span className="cmp-display text-3xl block mt-1">{drink}</span>
          <span className="text-xs tracking-[0.14em] uppercase cmp-muted">by {name}</span>
        </span>
      </button>

      {/* The judges' cards sit on top — until this guest's own ballot is
          open and still empty, then the ballot comes first so nobody has to
          scroll past three judges to find it. */}
      {showJudges && !ballotFirst && judgesBlock}

      <section className="mt-10">
        {closed ? (
          <div className="cmp-card p-6 text-center">
            <Check className="mx-auto text-[var(--cmp-accent)]" size={22} />
            <p className="mt-3 cmp-display text-2xl">Voting is closed</p>
            <p className="mt-2 text-sm cmp-muted">
              {mine ? "Your score was counted. Thank you!" : "Scores for this cocktail are in."}
            </p>
          </div>
        ) : !viewer ? null : open ? (
          <div className="cmp-card p-5">
            <h3 className="cmp-label text-center">{viewer.isJudge ? "Your Judge’s Ballot" : "Your Score"}</h3>
            <div className="mt-6 space-y-6">
              {ev.scoreCategories.map((cat) => (
                <div key={cat.id} className="flex flex-col items-center gap-2">
                  <span className="text-xs tracking-[0.2em] uppercase cmp-muted">{cat.label}</span>
                  <StarRow
                    value={draft[cat.id] ?? 0}
                    onChange={(v) => setDraft((d) => ({ ...d, [cat.id]: v }))}
                    size={36}
                    label={cat.label}
                  />
                </div>
              ))}
            </div>
            <button onClick={submit} disabled={!complete || saving || (!changed && !!mine)} className="cmp-btn w-full mt-8">
              {saving && <Loader2 size={15} className="animate-spin" />}
              {mine ? (changed ? "Update My Score" : "Score Submitted") : "Submit My Score"}
            </button>
            {msg && <p className={`mt-3 text-center text-sm ${msg.ok ? "cmp-muted" : "text-red-300"}`}>{msg.text}</p>}
            {!complete && !msg && (
              <p className="mt-3 text-center text-xs cmp-faint">Rate every category to submit.</p>
            )}
          </div>
        ) : (
          <div className="cmp-card p-6 text-center">
            <span className="inline-block w-2 h-2 rounded-full bg-[var(--cmp-accent)] cmp-pulse" />
            <p className="mt-3 cmp-display text-2xl">
              {viewer.isJudge ? "Judges’ voting opens soon" : s.judgeVoting ? "The judges are scoring" : "Voting opens soon"}
            </p>
            <p className="mt-2 text-sm cmp-muted">
              {viewer.isJudge
                ? "Your ballot will appear here when the host opens it."
                : "Your ballot will appear here as soon as guest voting opens."}
            </p>
          </div>
        )}
      </section>

      {showJudges && ballotFirst && judgesBlock}
    </div>
  );
}

function SuperlativesScreen({
  ev,
  s,
  picks,
  setPicks,
}: {
  ev: PublicEvent;
  s: LiveState;
  picks: Record<string, string>;
  setPicks: (fn: (v: Record<string, string>) => Record<string, string>) => void;
}) {
  const [err, setErr] = useState("");
  const open = !!s.superlativesOpen;

  const demo = useContext(SimContext);

  async function pick(superlativeId: string, contestantId: string) {
    const before = picks[superlativeId];
    setPicks((p) => ({ ...p, [superlativeId]: contestantId }));
    setErr("");
    if (demo) return;
    const res = await fetch(`/api/compete/${ev.slug}/pick`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ superlativeId, contestantId }),
    }).catch(() => null);
    if (!res?.ok) {
      setPicks((p) => ({ ...p, [superlativeId]: before }));
      const d = await res?.json().catch(() => null);
      setErr(d?.error ?? "That pick didn’t save. Please try again.");
    }
  }

  return (
    <div className="px-5 pt-10 cmp-rise">
      <div className="text-center">
        <div className="cmp-label">The Superlatives</div>
        <h2 className="cmp-display text-4xl mt-3">{open ? "Cast your picks" : "Picks are closed"}</h2>
        <p className="mt-3 text-sm cmp-muted">
          {open ? "One pick per category. Tap to choose — you can change your mind until voting closes." : "Winners will be revealed shortly."}
        </p>
      </div>
      {err && <p className="mt-4 text-center text-sm text-red-300">{err}</p>}
      <div className="mt-10 space-y-10">
        {ev.superlatives.map((sup) => (
          <section key={sup.id}>
            <h3 className="cmp-display text-2xl text-center">{sup.label}</h3>
            <div className="mt-4 space-y-2">
              {ev.contestants.map((c) => {
                const on = picks[sup.id] === c.id;
                return (
                  <button
                    key={c.id}
                    disabled={!open}
                    onClick={() => pick(sup.id, c.id)}
                    className="w-full flex items-center justify-between gap-3 px-4 py-3 border text-left transition-colors disabled:opacity-60"
                    style={{
                      borderColor: on ? "var(--cmp-accent)" : "var(--cmp-line)",
                      background: on ? "color-mix(in srgb, var(--cmp-accent) 12%, transparent)" : "transparent",
                    }}
                  >
                    <span className="min-w-0">
                      <span className="block italic truncate">“{cocktailName(ev.cocktailFields, c.cocktail)}”</span>
                      <span className="block text-[11px] tracking-[0.14em] uppercase cmp-muted truncate">
                        {bartenderName(ev.bartenderFields, c.bartender)}
                      </span>
                    </span>
                    <span
                      className="w-5 h-5 shrink-0 rounded-full border flex items-center justify-center"
                      style={{ borderColor: on ? "var(--cmp-accent)" : "var(--cmp-faint)" }}
                    >
                      {on && <span className="w-2.5 h-2.5 rounded-full bg-[var(--cmp-accent)]" />}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

function WinnersScreen({
  ev,
  s,
  byId,
  go,
}: {
  ev: PublicEvent;
  s: LiveState;
  byId: Map<string, PublicContestant>;
  go: (t: Tab) => void;
}) {
  const revealed = (s.revealed ?? []).filter((r) => r.contestantId);
  const total = ev.superlatives.length + 1;
  const finished = s.phase === "finished" || ev.status === "finished";
  const overall = revealed.find((r) => r.key === "overall");
  const others = revealed.filter((r) => r.key !== "overall");
  const newest = revealed[revealed.length - 1]?.key;

  return (
    <div className="px-5 pt-10">
      <div className="text-center">
        <div className="cmp-label">{finished ? ev.name : "The Results"}</div>
        <h2 className="cmp-display text-4xl mt-3">{finished ? "Congratulations" : "And the winners are…"}</h2>
      </div>

      <div className="mt-10 space-y-4">
        {overall && (
          <WinnerCard ev={ev} label={overall.label} contestant={byId.get(overall.contestantId)} fresh={newest === "overall"} />
        )}
        {[...others].reverse().map((r) => (
          <WinnerCard key={r.key} ev={ev} label={r.label} contestant={byId.get(r.contestantId)} fresh={newest === r.key} />
        ))}
        {!finished && (s.revealed?.length ?? 0) < total && (
          <div className="cmp-card p-6 text-center">
            <span className="inline-block w-2 h-2 rounded-full bg-[var(--cmp-accent)] cmp-pulse" />
            <p className="mt-3 text-sm cmp-muted">
              {revealed.length === 0 ? "The first award is coming up…" : "Next award coming up…"}
            </p>
          </div>
        )}
        {finished && revealed.length === 0 && <p className="text-center cmp-muted">Results will be posted soon.</p>}
      </div>

      {finished && ev.recipes.length > 0 && (
        <div className="mt-12 text-center">
          <p className="cmp-muted text-sm">Thank you for joining us. Take the night home with you:</p>
          <button className="cmp-btn w-full mt-5" onClick={() => go("home")}>
            Make Cocktails at Home
          </button>
        </div>
      )}
    </div>
  );
}
