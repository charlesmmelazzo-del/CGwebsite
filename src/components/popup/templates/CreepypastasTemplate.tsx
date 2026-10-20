"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import type { PopupCocktail, PopupTemplateProps } from "@/lib/popup/types";
import { REPLIES, say, type Moment } from "../creepypastas/hostDialogue";
import {
  beginVisit,
  forgetEverything,
  latestBookmark,
  readMemory,
  updateMemory,
  type GuestMemory,
} from "../creepypastas/memory";
import Reader from "../creepypastas/Reader";
import Recipes from "../creepypastas/Recipes";
import {
  loadCatalog,
  pickAny,
  pickTale,
  SCARE_CHOICES,
  TIME_CHOICES,
  type ScareId,
  type TaleCard,
  type TimeId,
} from "../creepypastas/tales";
import { Bartender, Choice, LOGO_SRC, SpeechBubble, voiceFont, type Pose } from "../creepypastas/ui";

/**
 * COMMON GOOD PRESENTS: COCKTAIL CREEPYPASTAS
 *
 * A ghoulish bartender fills the screen and offers two things, over and over:
 *
 *   A COCKTAIL RECIPE — he writes it down, then the four Halloween cocktails
 *                       appear as cards to swipe, each with a PDF to keep.
 *   A SPOOKY TALE     — how much time, how scary; he pitches one of 150
 *                       public-domain tales that fits. Take it, ask for
 *                       another, or change your mind. Taking it sends the
 *                       screen wavy and opens a scrolling reader.
 *
 * Coming back on the same phone, he remembers: the last tale finished, the
 * recipes taken, the story left half-read. After a first recipe or tale he
 * offers to add them to the mailing list, once.
 *
 * No accounts, no tickets. Everything a guest does is remembered only in this
 * browser (see creepypastas/memory.ts).
 */

type Phase = "logo" | "bar" | "writing" | "recipes" | "thinking" | "wavy" | "reader";

interface Reply {
  label: string;
  run: () => void;
  quiet?: boolean;
}

interface Scene {
  /** Speech bubbles, shown one at a time. */
  lines: string[];
  replies: Reply[];
  /** Show the email box under the last bubble. */
  emailForm?: boolean;
  /** Open with the greeting animation instead of plain talking. */
  greet?: boolean;
}

const WAVY_MS = 1100;

export default function CreepypastasTemplate({ menu, cocktails, isSandbox }: PopupTemplateProps) {
  const menuId = menu.id;
  const [phase, setPhase] = useState<Phase>("logo");
  const [scene, setScene] = useState<Scene>({ lines: [], replies: [] });
  const [step, setStep] = useState(0);
  const [pose, setPose] = useState<Pose>("idle");
  const [mem, setMem] = useState<GuestMemory | null>(null);
  const [writingLine, setWritingLine] = useState("");
  const [recipeLine, setRecipeLine] = useState("");
  const [reading, setReading] = useState<{ card: TaleCard; startAt: number } | null>(null);

  // This visit's story choices. Refs: they steer picks, not rendering.
  const time = useRef<TimeId>("five_to_ten");
  const scare = useRef<ScareId>("gentle");
  const offered = useRef(new Set<string>());
  const askedSignup = useRef(false);
  /** This reading reached THE END: stop saving a bookmark for it. */
  const reachedEnd = useRef(false);
  const timers = useRef<number[]>([]);

  const later = (fn: () => void, ms: number) => {
    timers.current.push(window.setTimeout(fn, ms));
  };
  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), []);

  const remember = useCallback(
    (change: (m: GuestMemory) => GuestMemory) => {
      const r = updateMemory(menuId, change);
      setMem(r.memory);
      return r.saved;
    },
    [menuId]
  );

  const line = (m: Moment) => say(menuId, m).lines;

  function speak(next: Scene) {
    setScene(next);
    setStep(0);
    setPhase("bar");
  }

  // He talks while a bubble is fresh, then settles into idle.
  const current = scene.lines[step] ?? "";
  useEffect(() => {
    if (phase !== "bar" || !current) return;
    setPose(scene.greet && step === 0 ? "greeting" : "talking");
    const words = current.split(/\s+/).length;
    const t = window.setTimeout(() => setPose("idle"), Math.min(4200, 900 + words * 140));
    return () => window.clearTimeout(t);
  }, [phase, current, step, scene.greet]);

  // ─── The main question ─────────────────────────────────────────────────────

  const signupDue = (m: GuestMemory | null) =>
    Boolean(m && !m.signup && !askedSignup.current && (m.recipes.length > 0 || m.finished.length > 0));

  function mainReplies(): Reply[] {
    return [
      { label: REPLIES.recipe, run: startRecipes },
      { label: REPLIES.tale, run: startTale },
      { label: REPLIES.done, run: farewell, quiet: true },
    ];
  }

  /** Back at the bar: ask about the mailing list if it's time, else what's next. */
  function backAtBar(prefix: string[] = [], m: GuestMemory | null = readMemory(menuId)) {
    if (signupDue(m)) return askSignup(prefix);
    speak({ lines: [...prefix, ...line("same_visit_return_to_main")], replies: mainReplies() });
  }

  function farewell() {
    speak({
      lines: line("farewell"),
      replies: [{ label: "Actually, one more thing", run: () => backAtBar() }],
    });
  }

  // ─── Arriving ──────────────────────────────────────────────────────────────

  async function enter() {
    const prior = beginVisit(menuId);
    setMem(readMemory(menuId));
    const question = line("intent_prompt");

    if (prior.visits === 0) {
      speak({ lines: [...line("fresh_welcome"), ...question], replies: mainReplies(), greet: true });
      return;
    }

    // A return visit. The catalog names their last tale; if it can't load,
    // greet them without the callback rather than not at all.
    setPhase("bar");
    setScene({ lines: ["…"], replies: [] });
    const catalog = await loadCatalog().catch(() => null);
    const find = (id: string | null) => catalog?.find((t) => t.id === id) ?? null;

    const mark = latestBookmark(prior);
    const marked = mark && find(mark.id);
    if (mark && marked) {
      speak({
        lines: [...line("returning_guest_welcome"), ...line("resume_unfinished_story")],
        replies: [
          { label: REPLIES.resume, run: () => openTale(marked, mark.bookmark.progress) },
          { label: REPLIES.somethingElse, run: () => speak({ lines: question, replies: mainReplies() }) },
        ],
        greet: true,
      });
      return;
    }

    const last = find(prior.lastFinished);
    const lines = last
      ? [
          ...line("returning_guest_welcome"),
          last.host.callback,
          ...(prior.recipes.length ? line("both_story_and_recipe_connective") : []),
        ]
      : prior.recipes.length
        ? [...line("returning_guest_welcome"), ...line("recipe_shared_return_callback")]
        : line("unknown_history_greeting");
    speak({ lines: [...lines, ...question], replies: mainReplies(), greet: true });
  }

  // ─── Recipes ───────────────────────────────────────────────────────────────

  function startRecipes() {
    setWritingLine(line("recipe_writing")[0]);
    setPhase("writing");
    setPose("writing");
    later(showRecipes, 2400);
  }

  function showRecipes() {
    setRecipeLine(line("recipe_ready")[0]);
    setPhase((p) => (p === "writing" ? "recipes" : p));
    // Seeing the recipes counts as being given one, for "how did it turn out?" next visit.
    remember((m) => ({ ...m, recipes: m.recipes.includes("*") ? m.recipes : [...m.recipes, "*"] }));
  }

  function downloaded(c: PopupCocktail) {
    remember((m) => ({ ...m, recipes: m.recipes.includes(c.id) ? m.recipes : [...m.recipes, c.id] }));
  }

  // ─── Tales ─────────────────────────────────────────────────────────────────

  function askTime(prefix: string[] = []) {
    void loadCatalog().catch(() => null); // warm it while they choose
    speak({
      lines: [...prefix, ...line("time_prompt")],
      replies: [
        ...TIME_CHOICES.map((t) => ({ label: t.label, run: () => chooseTime(t.id) })),
        { label: REPLIES.changedMind, run: changedMind, quiet: true },
      ],
    });
  }

  function startTale() {
    askTime();
  }

  function chooseTime(t: TimeId) {
    time.current = t;
    askScare(t === "all_the_time" ? line("all_the_time_response") : []);
  }

  function askScare(prefix: string[] = []) {
    speak({
      lines: [...prefix, ...line("scare_prompt")],
      replies: SCARE_CHOICES.map((s) => ({ label: s.label, run: () => chooseScare(s.id) })),
    });
  }

  function chooseScare(s: ScareId) {
    scare.current = s;
    setScene({ lines: line("story_thinking"), replies: [] });
    setStep(0);
    setPhase("thinking");
    setPose("thinking");
    later(() => void pitch(), 1800);
  }

  function changedMind() {
    backAtBar(line("story_changed_mind"));
  }

  const changeChoice: Reply = {
    label: REPLIES.changeChoices,
    run: () => askTime(line("new_search_transition")),
    quiet: true,
  };

  async function pitch(prefix: string[] = [], tale?: TaleCard) {
    let catalog: TaleCard[];
    try {
      catalog = await loadCatalog();
    } catch {
      speak({
        lines: ["My collection seems to be stuck in the cellar. Check your connection and we'll try again."],
        replies: [
          { label: "Try again", run: () => void pitch(prefix) },
          { label: REPLIES.backToBar, run: () => backAtBar(), quiet: true },
        ],
      });
      return;
    }

    const finished = new Set(readMemory(menuId).finished);
    const pick = tale ? { kind: "tale" as const, tale } : pickTale(catalog, time.current, scare.current, finished, offered.current);

    if (pick.kind === "tale") {
      const t = pick.tale;
      offered.current.add(t.id);
      speak({
        lines: [
          ...prefix,
          ...(t.underFive && time.current === "five_to_ten" ? line("under_five_minutes_leadin") : []),
          t.host.introduction,
          t.host.teaser,
          `${t.host.offerQuestion} (About ${t.readMinutes} minute${t.readMinutes === 1 ? "" : "s"} to read.)`,
        ],
        replies: [
          { label: REPLIES.accept, run: () => openTale(t, 0) },
          { label: REPLIES.another, run: () => void pitch(line("decline_and_offer_another")) },
          changeChoice,
          { label: REPLIES.changedMind, run: changedMind, quiet: true },
        ],
      });
      return;
    }

    if (pick.kind === "none") {
      speak({
        lines: [...prefix, ...line("no_matching_story")],
        replies: [
          { label: "Change the time", run: () => askTime() },
          { label: "Change the scare level", run: () => askScare() },
          { label: REPLIES.backToBar, run: () => backAtBar(), quiet: true },
        ],
      });
      return;
    }

    const revisit: Reply =
      pick.kind === "allHeard"
        ? {
            label: REPLIES.revisit,
            run: () => {
              const again = pickAny(catalog, time.current, scare.current);
              if (again) void pitch([], again);
            },
          }
        : {
            label: REPLIES.revisitOffered,
            run: () => {
              offered.current.clear();
              void pitch();
            },
          };
    speak({
      lines: [...prefix, ...line(pick.kind === "allHeard" ? "all_matching_stories_heard" : "all_matching_stories_offered")],
      replies: [revisit, changeChoice, { label: REPLIES.recipesInstead, run: startRecipes, quiet: true }],
    });
  }

  function openTale(card: TaleCard, startAt: number) {
    reachedEnd.current = false;
    setReading({ card, startAt });
    setPhase("wavy");
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    later(() => setPhase((p) => (p === "wavy" ? "reader" : p)), reduced ? 250 : WAVY_MS);
  }

  const saveProgress = useCallback(
    (progress: number) => {
      if (!reading) return false;
      if (reachedEnd.current) return true;
      const { id, contentVersion } = reading.card;
      return remember((m) => ({
        ...m,
        bookmarks: { ...m.bookmarks, [id]: { contentVersion, progress, at: new Date().toISOString() } },
      }));
    },
    [reading, remember]
  );

  const finishedTale = useCallback(() => {
    if (!reading) return;
    reachedEnd.current = true;
    const id = reading.card.id;
    remember((m) => {
      const bookmarks = { ...m.bookmarks };
      delete bookmarks[id];
      return { ...m, bookmarks, lastFinished: id, finished: m.finished.includes(id) ? m.finished : [...m.finished, id] };
    });
  }, [reading, remember]);

  const exitTale = useCallback(
    (progress: number, done: boolean) => {
      setReading(null);
      if (done) {
        const m = readMemory(menuId);
        if (signupDue(m)) return askSignup(line("story_completion_outro").slice(0, 1));
        speak({
          lines: line("story_completion_outro"),
          replies: [
            { label: "Another spooky tale", run: () => askTime() },
            { label: REPLIES.recipe, run: startRecipes },
            { label: REPLIES.backToBar, run: () => backAtBar(), quiet: true },
          ],
        });
        return;
      }
      saveProgress(progress);
      backAtBar(line("story_left_early"));
    },
    // The helpers above are plain functions over refs and stable setters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [menuId, saveProgress]
  );

  // ─── The mailing list ──────────────────────────────────────────────────────

  function askSignup(prefix: string[] = []) {
    askedSignup.current = true;
    speak({
      lines: [...prefix, ...line("email_signup_ask")],
      replies: [
        { label: REPLIES.signupYes, run: () => speak({ lines: line("email_signup_ask_email"), replies: [], emailForm: true }) },
        { label: REPLIES.signupNo, run: declineSignup, quiet: true },
      ],
    });
  }

  function declineSignup() {
    remember((m) => ({ ...m, signup: "declined" }));
    backAtBar(line("email_signup_declined"));
  }

  function joined() {
    remember((m) => ({ ...m, signup: "joined" }));
    speak({ lines: [...line("email_signup_thanks"), ...line("same_visit_return_to_main")], replies: mainReplies() });
  }

  // ─── Rendering ─────────────────────────────────────────────────────────────

  const lastStep = step >= scene.lines.length - 1;
  const showBar = phase === "bar" || phase === "thinking" || phase === "writing" || phase === "wavy" || phase === "reader";

  return (
    <div className="relative h-[calc(100dvh-49px)] bg-black text-white overflow-hidden">
      <WavyFilter />

      {phase === "logo" && <Logo onEnter={() => void enter()} />}

      {phase === "recipes" && (
        <Recipes
          cocktails={cocktails}
          line={recipeLine}
          onDownload={downloaded}
          onBack={() => backAtBar()}
        />
      )}

      {showBar && (
        <div
          className={`h-full flex flex-col ${phase === "wavy" ? "creepy-wavy" : ""}`}
          aria-hidden={phase === "reader"}
        >
          <div className="shrink-0 px-4 pt-4 pb-4 max-h-[46%] overflow-y-auto">
            {phase === "writing" ? (
              <SpeechBubble onNext={showRecipes}>{writingLine}</SpeechBubble>
            ) : current ? (
              <SpeechBubble onNext={lastStep ? undefined : () => setStep((s) => s + 1)}>{current}</SpeechBubble>
            ) : null}
          </div>

          <div className="flex-1 min-h-[96px] pt-1 px-6">
            <Bartender pose={pose} />
          </div>

          <div className="shrink-0 px-4 pb-4 pt-3 max-h-[46%] overflow-y-auto flex flex-col gap-2">
            {phase === "bar" && !lastStep && (
              <Choice quiet onClick={() => setStep((s) => s + 1)}>
                {REPLIES.next}
              </Choice>
            )}
            {phase === "bar" && lastStep && scene.emailForm && (
              <EmailForm menuId={menuId} onJoined={joined} onCancel={declineSignup} />
            )}
            {phase === "bar" &&
              lastStep &&
              scene.replies.map((r) => (
                <Choice key={r.label} quiet={r.quiet} onClick={r.run}>
                  {r.label}
                </Choice>
              ))}
          </div>
        </div>
      )}

      {phase === "reader" && reading && mem && (
        <Reader
          card={reading.card}
          startAt={reading.startAt}
          textScale={mem.textScale}
          onTextScale={(textScale) => remember((m) => ({ ...m, textScale }))}
          onProgress={saveProgress}
          onFinished={finishedTale}
          onExit={exitTale}
        />
      )}

      {isSandbox && (
        <button
          type="button"
          onClick={() => {
            forgetEverything(menuId);
            window.location.reload();
          }}
          className={`${voiceFont.className} absolute left-2 bottom-2 z-[80] bg-amber-400 text-black text-[11px] px-2 py-1 rounded`}
        >
          Sandbox: forget this phone
        </button>
      )}
    </div>
  );
}

// ─── Pieces ──────────────────────────────────────────────────────────────────

function Logo({ onEnter }: { onEnter: () => void }) {
  return (
    <div className="h-full flex flex-col items-center justify-center px-6 text-center">
      {LOGO_SRC ? (
        // eslint-disable-next-line @next/next/no-img-element -- pixel art, served as-is
        <img
          src={LOGO_SRC}
          alt="Common Good Presents: Cocktail Creepypastas"
          className="w-full max-w-[520px] h-auto"
          style={{ imageRendering: "pixelated" }}
        />
      ) : (
        <h1 className={voiceFont.className}>
          <span className="block text-[13px] tracking-[0.35em] text-white/70">COMMON GOOD PRESENTS</span>
          <span className="block mt-3 text-[44px] sm:text-[60px] leading-[0.95]">
            COCKTAIL
            <br />
            CREEPYPASTAS
          </span>
        </h1>
      )}
      <div className="mt-12 w-full max-w-[300px]">
        <Choice onClick={onEnter}>
          <span className="block w-full text-center">{REPLIES.enter}</span>
        </Choice>
      </div>
    </div>
  );
}

/**
 * The screen ripples and blurs as he starts the tale. An SVG displacement
 * filter does the ripple; the CSS animation adds blur and dims to black.
 * Skipped for reduced motion. The reader replaces it on a timer, never on an
 * animation event, so a paused background tab can't strand anyone here.
 */
function WavyFilter() {
  return (
    <>
      <svg width="0" height="0" className="absolute" aria-hidden>
        <filter id="creepy-wave">
          <feTurbulence type="fractalNoise" baseFrequency="0.012 0.06" numOctaves="2" seed="7">
            <animate attributeName="baseFrequency" dur="1.1s" values="0.012 0.06;0.02 0.12;0.012 0.06" repeatCount="indefinite" />
          </feTurbulence>
          <feDisplacementMap in="SourceGraphic" scale="0">
            <animate attributeName="scale" dur="1.1s" values="0;60" fill="freeze" />
          </feDisplacementMap>
        </filter>
      </svg>
      <style>{`
        .creepy-wavy { animation: creepy-wavy ${WAVY_MS}ms ease-in forwards; }
        @keyframes creepy-wavy {
          0%   { filter: url(#creepy-wave) blur(0); opacity: 1; }
          100% { filter: url(#creepy-wave) blur(10px); opacity: 0; }
        }
        @media (prefers-reduced-motion: reduce) { .creepy-wavy { animation: none; opacity: 0; } }
      `}</style>
    </>
  );
}

function EmailForm({ menuId, onJoined, onCancel }: { menuId: string; onJoined: () => void; onCancel: () => void }) {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/popup/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, menuId, website: "" }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "That didn't go through. Please try again.");
      onJoined();
    } catch (err) {
      setError(err instanceof Error ? err.message : "That didn't go through. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-2" noValidate>
      <label htmlFor="creepy-email" className={`${voiceFont.className} text-[14px] text-white/70`}>
        Your email
      </label>
      <input
        id="creepy-email"
        type="email"
        inputMode="email"
        autoComplete="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? "creepy-email-error" : undefined}
        className="w-full min-h-[48px] px-3 bg-black border-2 border-white rounded-[6px] text-[17px] text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
      />
      {error && (
        <p id="creepy-email-error" className={`${voiceFont.className} text-[14px] text-white`} role="alert">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={busy || !email.trim()}
        className={`${voiceFont.className} min-h-[48px] rounded-[6px] bg-white text-black text-[17px] disabled:opacity-40`}
      >
        {busy ? "Adding you…" : "Add me to the ledger"}
      </button>
      <Choice quiet onClick={onCancel}>
        Never mind
      </Choice>
      <p className="text-[12px] text-white/45">
        Just news about Common Good pop-ups and events. Unsubscribe anytime.
      </p>
    </form>
  );
}
