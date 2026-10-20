"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties, type FormEvent } from "react";
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
import Reader, { type Place } from "../creepypastas/Reader";
import Recipes, { recipePdf } from "../creepypastas/Recipes";
import {
  loadCatalog,
  pickAny,
  pickTale,
  SCARE_CHOICES,
  TIME_CHOICES,
  type ScareId,
  type TaleCard,
  type TaleVersion,
  type TimeId,
} from "../creepypastas/tales";
import { ALL_FRAMES, Bartender, Choice, ChoiceLink, DialogueBox, LOGO_SRC, voiceFont, type Pose } from "../creepypastas/ui";

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

type Phase = "logo" | "bar" | "recipes" | "wavy" | "reader";

interface Reply {
  label: string;
  run: () => void;
  quiet?: boolean;
  /** Make it a link to this file (the recipe PDF); `run` fires as it opens. */
  href?: string;
}

interface Scene {
  /** Speech bubbles, shown one at a time. */
  lines: string[];
  replies: Reply[];
  /** Show the email box under the last bubble. */
  emailForm?: boolean;
  /** Open with the greeting animation instead of plain talking. */
  greet?: boolean;
  /**
   * Hold this pose for the whole scene (writing out a recipe, thinking of a
   * tale) instead of talking. Every scene still waits for the guest's tap —
   * nothing moves on by itself, since everyone reads at their own pace.
   */
  pose?: "writing" | "thinking";
}

const WAVY_MS = 1100;

export default function CreepypastasTemplate({ menu, cocktails, isSandbox }: PopupTemplateProps) {
  const menuId = menu.id;
  const [phase, setPhase] = useState<Phase>("logo");
  const [scene, setScene] = useState<Scene>({ lines: [], replies: [] });
  const [step, setStep] = useState(0);
  const [pose, setPose] = useState<Pose>("idle");
  const [mem, setMem] = useState<GuestMemory | null>(null);
  /** Which recipe card to open on (coming back for "another"). */
  const [cardIndex, setCardIndex] = useState(0);
  const [reading, setReading] = useState<{
    card: TaleCard;
    startAt: number;
    startPara?: number;
    version: TaleVersion;
    modernBridge: string;
  } | null>(null);

  /** The current line has finished typing out; the replies appear after. */
  const [typed, setTyped] = useState(false);
  /** The screen is fading out before the next one fades in. */
  const [leaving, setLeaving] = useState(false);

  // This visit's story choices. Refs: they steer picks, not rendering.
  const time = useRef<TimeId>("five_to_ten");
  const scare = useRef<ScareId>("gentle");
  const offered = useRef(new Set<string>());
  const askedSignup = useRef(false);
  /** The recipe being written out. Guards the hand-over so a tap and the timer can't both run it. */
  const writingFor = useRef<PopupCocktail | null>(null);
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
    setTyped(false);
    setPhase("bar");
  }

  /**
   * Fade the current screen out, then switch. The next screen fades itself
   * in as it mounts. Driven by a timer, not an animation event, so a paused
   * background tab can never strand anyone mid-fade.
   */
  function fadeTo(change: () => void) {
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduced) return change();
    setLeaving(true);
    later(() => {
      setLeaving(false);
      change();
    }, 240);
  }

  const current = scene.lines[step] ?? "";

  // A new line starts typing from scratch.
  useEffect(() => setTyped(false), [current, step, phase]);

  // He moves his mouth while the line types out, then settles into idle.
  useEffect(() => {
    if (phase !== "bar" || !current) return;
    if (scene.pose) return setPose(scene.pose);
    if (typed) return setPose("idle");
    // A greeting is one raised glass (4 frames), then he talks as usual.
    const greeting = scene.greet && step === 0;
    setPose(greeting ? "greeting" : "talking");
    if (!greeting) return;
    const t = window.setTimeout(() => setPose("talking"), 1040);
    return () => window.clearTimeout(t);
  }, [phase, current, step, scene.greet, scene.pose, typed]);

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
          {
            label: REPLIES.resume,
            run: () =>
              openTale(marked, {
                startAt: mark.bookmark.progress,
                startPara: mark.bookmark.para,
                // Only trust a saved "modern" if that telling still exists.
                version: mark.bookmark.version === "modern" && marked.modern ? "modern" : "original",
              }),
          },
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

  /** "A cocktail recipe": he asks which; the cards fade in when they're ready. */
  function startRecipes() {
    speak({ lines: line("recipe_menu_intro"), replies: [{ label: REPLIES.showCocktails, run: () => fadeTo(showCards) }] });
  }

  function showCards() {
    setPhase("recipes");
  }

  /** "Give me the recipe": back to him while he writes it out. */
  function pickRecipe(c: PopupCocktail, index: number) {
    setCardIndex(index);
    writingFor.current = c;
    fadeTo(() =>
      speak({
        lines: line("recipe_writing").slice(0, 1),
        replies: [{ label: REPLIES.next, run: handOver }],
        pose: "writing",
      })
    );
  }

  /** The recipe's written: the download button, then "another?". */
  function handOver() {
    const c = writingFor.current;
    if (!c) return;
    writingFor.current = null;
    remember((m) => ({ ...m, recipes: m.recipes.includes(c.id) ? m.recipes : [...m.recipes, c.id] }));

    const another = () =>
      speak({
        lines: line("recipe_another"),
        replies: [
          { label: REPLIES.anotherRecipe, run: () => fadeTo(showCards) },
          { label: REPLIES.noMoreRecipes, run: () => backAtBar(), quiet: true },
        ],
      });

    const pdf = recipePdf(c);
    if (!pdf) {
      speak({ lines: line("recipe_no_pdf"), replies: [{ label: REPLIES.next, run: another }] });
      return;
    }
    speak({
      lines: line("recipe_ready"),
      replies: [{ label: `${REPLIES.download}: ${c.name}`, href: pdf, run: () => later(another, 600) }],
    });
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
    speak({ lines: line("story_thinking"), replies: [{ label: REPLIES.next, run: () => void pitch() }], pose: "thinking" });
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
          { label: REPLIES.accept, run: () => (t.modern ? chooseVersion(t) : openTale(t)) },
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

  /** For a tale with a modern retelling: which would they like? */
  function chooseVersion(card: TaleCard) {
    speak({
      lines: line("version_choice_prompt"),
      replies: [
        { label: REPLIES.original, run: () => openTale(card, { version: "original" }) },
        { label: REPLIES.modern, run: () => openTale(card, { version: "modern" }) },
      ],
    });
  }

  function openTale(
    card: TaleCard,
    { startAt = 0, startPara, version = "original" }: { startAt?: number; startPara?: number; version?: TaleVersion } = {}
  ) {
    reachedEnd.current = false;
    setReading({ card, startAt, startPara, version, modernBridge: line("modern_bridge")[0] });
    setPhase("wavy");
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    later(() => setPhase((p) => (p === "wavy" ? "reader" : p)), reduced ? 250 : WAVY_MS);
  }

  const saveProgress = useCallback(
    ({ progress, para }: Place) => {
      if (!reading) return false;
      if (reachedEnd.current) return true;
      const { card, version } = reading;
      return remember((m) => ({
        ...m,
        bookmarks: {
          ...m.bookmarks,
          [card.id]: {
            contentVersion: card.contentVersion,
            progress,
            ...(para >= 0 ? { para } : {}),
            version,
            at: new Date().toISOString(),
          },
        },
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
    (place: Place, done: boolean) => {
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
      saveProgress(place);
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
  const atBar = phase === "bar" || phase === "wavy";
  // Each screen fades in when it mounts; `leaving` fades the current one out.
  const screen = (extra = "") => `absolute inset-0 ${leaving ? "creepy-leave" : "creepy-screen"} ${extra}`;

  const replies = scene.replies;
  return (
    <div className="relative h-[calc(100dvh-49px)] bg-black text-white overflow-hidden">
      <WavyFilter />

      {phase === "logo" && (
        <div key="logo" className={screen()}>
          <Logo onEnter={() => fadeTo(() => void enter())} />
        </div>
      )}

      {phase === "recipes" && (
        <div key="recipes" className={screen()}>
          <Recipes
            cocktails={cocktails}
            startAt={cardIndex}
            onPick={pickRecipe}
            onBack={() => fadeTo(() => backAtBar())}
          />
        </div>
      )}

      {atBar && (
        <div
          key="bar"
          className={phase === "wavy" ? "absolute inset-0 creepy-wavy" : screen()}
        >
          <div className="h-full flex flex-col">
            {/* He keeps a fixed share of the screen, so nothing below can resize him. */}
            <div className="flex-1 min-h-0 px-4 pt-3">
              <Bartender pose={pose} />
            </div>

            {/* His words and the guest's replies share one fixed panel at the bottom. */}
            <div className="shrink-0 h-[50%] min-h-[250px] max-h-[420px] px-4 pt-3 pb-4 flex flex-col gap-3">
              <DialogueBox
                text={current}
                typed={typed}
                onTyped={() => setTyped(true)}
                onTap={!lastStep ? () => setStep((n) => n + 1) : undefined}
                more={phase === "bar" && !lastStep}
              />

              {phase === "bar" && typed && !lastStep && (
                <div key={`next-${step}`} className="shrink-0 creepy-in">
                  <Choice quiet onClick={() => setStep((n) => n + 1)}>
                    {REPLIES.next}
                  </Choice>
                </div>
              )}

              {phase === "bar" && typed && lastStep && scene.emailForm && (
                <div className="shrink-0 creepy-in">
                  <EmailForm menuId={menuId} onJoined={joined} onCancel={declineSignup} />
                </div>
              )}

              {phase === "bar" && typed && lastStep && replies.length > 0 && (
                <div key={`replies-${replies.map((r) => r.label).join("|")}`} className="shrink-0 grid grid-cols-2 gap-2">
                  {replies.map((r, i) => (
                    <div
                      key={r.label}
                      className={`creepy-in ${replies.length % 2 === 1 && i === replies.length - 1 ? "col-span-2" : ""}`}
                      style={{ "--i": i } as CSSProperties}
                    >
                      {r.href ? (
                        <ChoiceLink href={r.href} onClick={r.run}>
                          {r.label}
                        </ChoiceLink>
                      ) : (
                        <Choice small quiet={r.quiet} onClick={r.run}>
                          {r.label}
                        </Choice>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {phase === "reader" && reading && mem && (
        <div key="reader" className={`fixed inset-0 z-[70] ${leaving ? "creepy-leave" : "creepy-screen"}`}>
          <Reader
            card={reading.card}
            version={reading.version}
            onVersion={(version) => setReading((r) => (r ? { ...r, version } : r))}
            startAt={reading.startAt}
            startPara={reading.startPara}
            modernBridge={reading.modernBridge}
            textScale={mem.textScale}
            onTextScale={(textScale) => remember((m) => ({ ...m, textScale }))}
            onProgress={saveProgress}
            onFinished={finishedTale}
            onExit={(place, done) => fadeTo(() => exitTale(place, done))}
          />
        </div>
      )}

      {/* Only on the logo screen, where it can't cover a reply. Reloading returns here. */}
      {isSandbox && phase === "logo" && (
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
  // Fetch his frames while the guest looks at the logo, so he never flickers
  // in frame by frame the first time he talks.
  useEffect(() => {
    for (const src of ALL_FRAMES) {
      const img = new Image();
      img.src = src;
    }
  }, []);

  return (
    <div className="h-full flex flex-col items-center justify-center px-6 text-center">
      {LOGO_SRC ? (
        // eslint-disable-next-line @next/next/no-img-element -- pixel art, served as-is
        <img
          src={LOGO_SRC}
          alt="Common Good Presents: Cocktail Creepypastas"
          width={1000}
          height={200}
          className="w-full max-w-[560px] h-auto"
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
          {REPLIES.enter}
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
        .creepy-screen { animation: creepy-screen-in 420ms ease-out both; }
        @keyframes creepy-screen-in {
          from { opacity: 0; filter: blur(6px); transform: scale(0.985); }
          to   { opacity: 1; filter: none; transform: none; }
        }
        .creepy-leave { animation: creepy-screen-out 240ms ease-in both; }
        @keyframes creepy-screen-out { to { opacity: 0; filter: blur(6px); } }
        .creepy-in { animation: creepy-in 320ms cubic-bezier(0.2, 0.7, 0.2, 1) both; animation-delay: calc(var(--i, 0) * 80ms); }
        @keyframes creepy-in {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: none; }
        }
        @media (prefers-reduced-motion: reduce) {
          .creepy-wavy { animation: none; opacity: 0; }
          .creepy-screen, .creepy-leave, .creepy-in { animation: none; }
        }
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
