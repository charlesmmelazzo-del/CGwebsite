"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import type { PopupCocktail, PopupTemplateProps } from "@/lib/popup/types";
import {
  COPY,
  INTRO_PANELS,
  MAIN_QUESTION,
  MAIN_QUESTION_SHORT,
  type HostLine,
} from "../creepypastas/hostDialogue";
import { drawLine, hasVisited, markVisited } from "../creepypastas/lineRotation";
import {
  Choice,
  DialogueBox,
  HostSays,
  LOGO_SRC,
  QuietAction,
  readFont,
  titleFont,
  voiceFont,
} from "../creepypastas/ui";

/**
 * COCKTAIL CREEPYPASTAS — a Halloween anthology. Four cocktails, each with its
 * own choose-your-own-adventure story, introduced by a scripted host who is
 * magnificent and thinks rather less of you.
 *
 *   ENTRANCE  — the title and "Click here to enter… if you dare!"
 *   INTRO     — first visit only: three short panels, skippable.
 *   HOST      — "What did you order?" Returning guests get one short greeting.
 *   PICK      — the four cocktails, either to unlock (ordered) or to read about.
 *   ABOUT     — In the glass / In the tale. Browsing never unlocks anything.
 *   ORDERED   — one cocktail chosen to unlock with the ticket from the drink.
 *
 * The ticket step and the story reader come next; ORDERED holds their place.
 *
 * The screens are local state rather than routes, so moving around inside the
 * pop-up never sends a guest back through the entrance — only a fresh arrival
 * (a new page load) does.
 */

type Screen =
  | { name: "entrance" }
  | { name: "intro"; panel: number }
  | { name: "host" }
  | { name: "pick"; mode: "ordered" | "browse" }
  | { name: "about"; cocktailId: string }
  | { name: "ordered"; cocktailId: string };

export default function CreepypastasTemplate({ menu, cocktails, isLive, isSandbox }: PopupTemplateProps) {
  const [screen, setScreen] = useState<Screen>({ name: "entrance" });

  // What the Host is saying. Drawn when something happens, then held still
  // while the guest reads — never re-picked on render.
  const [greeting, setGreeting] = useState<HostLine | null>(null);
  const [frame, setFrame] = useState<HostLine | null>(null);

  // Reaching the end of the introduction counts as having met him.
  const introDone = screen.name === "intro" && screen.panel === INTRO_PANELS.length - 1;
  useEffect(() => {
    if (introDone) markVisited(menu.id);
  }, [introDone, menu.id]);

  const find = (id: string) => cocktails.find((c) => c.id === id) ?? null;

  function enter() {
    if (hasVisited(menu.id)) {
      setGreeting(drawLine(menu.id, "welcome.returning", "welcome.short"));
      setScreen({ name: "host" });
    } else {
      setScreen({ name: "intro", panel: 0 });
    }
  }

  function finishIntro() {
    markVisited(menu.id);
    setGreeting(null);
    setScreen({ name: "host" });
  }

  function pick(mode: "ordered" | "browse") {
    setFrame(drawLine(menu.id, mode === "ordered" ? "order.which" : "browse.entry"));
    setScreen({ name: "pick", mode });
  }

  function chooseOrdered(c: PopupCocktail) {
    setFrame(drawLine(menu.id, "cocktail.selected"));
    setScreen({ name: "ordered", cocktailId: c.id });
  }

  const mainChoices = (
    <>
      <Choice primary onClick={() => pick("ordered")}>
        {COPY.ordered}
      </Choice>
      <Choice primary onClick={() => pick("browse")}>
        {COPY.notOrdered}
      </Choice>
    </>
  );

  let body: ReactNode;
  switch (screen.name) {
    case "entrance":
      body = <Entrance onEnter={enter} />;
      break;

    case "intro": {
      const last = screen.panel === INTRO_PANELS.length - 1;
      body = (
        <Stage screenKey={`intro-${screen.panel}`}>
          <HostSays line={INTRO_PANELS[screen.panel]} extra={last ? MAIN_QUESTION : undefined} />
          <Choices>
            {last ? (
              mainChoices
            ) : (
              <Choice primary onClick={() => setScreen({ name: "intro", panel: screen.panel + 1 })}>
                {COPY.next}
              </Choice>
            )}
          </Choices>
          {!last && (
            <Footer>
              <QuietAction onClick={finishIntro}>{COPY.skipIntro}</QuietAction>
              <span className="text-[12px] text-white/35">
                {screen.panel + 1} / {INTRO_PANELS.length}
              </span>
            </Footer>
          )}
        </Stage>
      );
      break;
    }

    case "host":
      body = (
        <Stage screenKey="host">
          <HostSays
            line={greeting}
            extra={greeting ? MAIN_QUESTION_SHORT : MAIN_QUESTION}
            expression={greeting?.expression ?? "appraising"}
          />
          <Choices>{mainChoices}</Choices>
          <Footer>
            <QuietAction onClick={() => setScreen({ name: "intro", panel: 0 })}>{COPY.hearIntro}</QuietAction>
          </Footer>
        </Stage>
      );
      break;

    case "pick":
      body = (
        <Stage screenKey={`pick-${screen.mode}`}>
          <HostSays line={frame} />
          <Choices label={screen.mode === "ordered" ? "Which cocktail did you order?" : "Which cocktail?"}>
            {cocktails.length === 0 && <p className={`${readFont.className} text-white/60`}>{COPY.noCocktails}</p>}
            {cocktails.map((c) => (
              <Choice
                key={c.id}
                primary
                onClick={() =>
                  screen.mode === "ordered" ? chooseOrdered(c) : setScreen({ name: "about", cocktailId: c.id })
                }
              >
                {c.name || "Untitled cocktail"}
              </Choice>
            ))}
            <Choice onClick={() => setScreen({ name: "host" })}>{COPY.backToHost}</Choice>
          </Choices>
          {screen.mode === "browse" && <ServiceNote />}
        </Stage>
      );
      break;

    case "about": {
      const c = find(screen.cocktailId);
      body = c ? (
        <Stage screenKey={`about-${c.id}`}>
          <HostSays line={frame} />
          <CocktailFacts cocktail={c} />
          <Choices>
            <Choice primary onClick={() => setScreen({ name: "pick", mode: "browse" })}>
              {COPY.anotherCocktail}
            </Choice>
            <Choice primary onClick={() => chooseOrdered(c)}>
              {COPY.orderedThis}
            </Choice>
            <Choice onClick={() => setScreen({ name: "host" })}>{COPY.backToHost}</Choice>
          </Choices>
          <ServiceNote />
        </Stage>
      ) : (
        <Missing onBack={() => setScreen({ name: "host" })} />
      );
      break;
    }

    case "ordered": {
      const c = find(screen.cocktailId);
      body = c ? (
        <Stage screenKey={`ordered-${c.id}`}>
          <HostSays line={frame} />
          <section aria-labelledby="ordered-name" className="mt-6">
            <h2 id="ordered-name" className={`${titleFont.className} text-[34px] leading-tight text-white`}>
              {c.name}
            </h2>
            {c.tagline && <p className={`${readFont.className} italic text-white/65 mt-1`}>{c.tagline}</p>}
            {/* Placeholder for the next build: the ticket form and the story. */}
            <DialogueBox className="mt-4">
              <p className={`${voiceFont.className} text-[13px] tracking-[0.15em] uppercase text-white/50`}>
                Story · Locked
              </p>
              <p className={`${readFont.className} mt-2 text-[16px] leading-relaxed text-white/85`}>
                Entering the ticket from your drink to unlock this story is coming in the next build.
              </p>
            </DialogueBox>
          </section>
          <Choices>
            <Choice primary onClick={() => setScreen({ name: "about", cocktailId: c.id })}>
              {COPY.readAbout}
            </Choice>
            <Choice onClick={() => pick("ordered")}>{COPY.differentCocktail}</Choice>
            <Choice onClick={() => setScreen({ name: "host" })}>{COPY.backToHost}</Choice>
          </Choices>
        </Stage>
      ) : (
        <Missing onBack={() => setScreen({ name: "host" })} />
      );
      break;
    }
  }

  return (
    <div className="relative min-h-[calc(100dvh-49px)] bg-black text-white overflow-x-hidden">
      {/* A faint vignette, so pure black doesn't read as a page that failed to load. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{ background: "radial-gradient(120% 80% at 50% 0%, #1c1c1c 0%, #000 70%)" }}
      />
      <div className="relative">
        {!isLive && !isSandbox && (
          <p className={`${voiceFont.className} pt-4 text-center text-[12px] tracking-[0.2em] uppercase text-white/45`}>
            This pop-up has ended
          </p>
        )}
        {body}
      </div>
    </div>
  );
}

// ─── Screens and pieces ──────────────────────────────────────────────────────

function Entrance({ onEnter }: { onEnter: () => void }) {
  return (
    <div className="min-h-[calc(100dvh-49px)] flex flex-col items-center justify-center px-5 py-12 text-center">
      {LOGO_SRC ? (
        // eslint-disable-next-line @next/next/no-img-element -- pixel art, served as-is (see StartScreen)
        <img
          src={LOGO_SRC}
          alt="Cocktail Creepypastas"
          className="w-full max-w-[520px] h-auto"
          style={{ imageRendering: "pixelated" }}
        />
      ) : (
        <h1
          className={`${titleFont.className} text-[56px] sm:text-[76px] leading-[0.95] text-white`}
          style={{ textShadow: "4px 4px 0 #3b3b3b" }}
        >
          Cocktail
          <br />
          Creepypastas
        </h1>
      )}
      <p className={`${voiceFont.className} mt-5 text-[15px] text-white/60`}>{COPY.enterNote}</p>

      <div className="mt-10 w-full max-w-[360px]">
        <button
          type="button"
          onClick={onEnter}
          autoFocus
          className={`${voiceFont.className} w-full min-h-[64px] px-5 py-4 text-[20px] leading-snug bg-black text-white border-[3px] border-white rounded-[6px]
            [@media(hover:hover)]:hover:bg-white [@media(hover:hover)]:hover:text-black focus:outline-none focus-visible:bg-white focus-visible:text-black transition-colors`}
          style={{ boxShadow: "0 0 0 3px #000, 0 0 0 5px rgba(255,255,255,0.35)" }}
        >
          {COPY.enter}
        </button>
      </div>
    </div>
  );
}

/**
 * One screen of the conversation. When it appears, focus moves to it so a
 * keyboard or screen-reader user starts at the new text, not wherever the
 * button they pressed used to be. No fade or typewriter: each passage shows
 * at once (the brief asks for that, and an animation starting at opacity 0
 * stays invisible in a tab the browser has paused).
 */
function Stage({ screenKey, children }: { screenKey: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.focus({ preventScroll: true });
    window.scrollTo({ top: 0 });
  }, [screenKey]);

  return (
    <div
      ref={ref}
      tabIndex={-1}
      className="mx-auto w-full max-w-[540px] px-4 pt-6 pb-12 focus:outline-none"
    >
      {children}
    </div>
  );
}

function Choices({ children, label }: { children: ReactNode; label?: string }) {
  return (
    <div role="group" aria-label={label ?? "Your response"} className="mt-6 flex flex-col gap-2.5">
      {children}
    </div>
  );
}

function Footer({ children }: { children: ReactNode }) {
  return <div className="mt-4 flex items-center justify-between gap-3">{children}</div>;
}

/** "In the glass" and "In the tale": the drink's facts and the story's pitch, kept apart. */
function CocktailFacts({ cocktail: c }: { cocktail: PopupCocktail }) {
  const glass = [c.description, c.ingredients].filter((s): s is string => Boolean(s?.trim()));
  const tale = c.story?.trim();

  return (
    <section aria-labelledby="about-name" className="mt-6">
      <h2 id="about-name" className={`${titleFont.className} text-[34px] leading-tight text-white`}>
        {c.name}
      </h2>
      {c.tagline && <p className={`${readFont.className} italic text-white/65 mt-1`}>{c.tagline}</p>}

      <div className="mt-4 grid gap-3">
        <FactBlock title={COPY.inTheGlass}>
          {glass.length ? (
            <>
              {c.description?.trim() && <Paragraphs text={c.description} />}
              {c.ingredients?.trim() && (
                <p className="mt-2 text-white/70 text-[15px]">
                  <span className="sr-only">Ingredients: </span>
                  {c.ingredients}
                </p>
              )}
            </>
          ) : (
            <p className="text-white/50 italic">{COPY.glassPending}</p>
          )}
        </FactBlock>
        <FactBlock title={COPY.inTheTale}>
          {tale ? <Paragraphs text={tale} /> : <p className="text-white/50 italic">{COPY.talePending}</p>}
        </FactBlock>
      </div>
    </section>
  );
}

function FactBlock({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="border-2 border-white/35 rounded-[4px] px-4 py-3.5">
      <h3 className={`${voiceFont.className} text-[13px] tracking-[0.18em] uppercase text-white/60`}>{title}</h3>
      <div className={`${readFont.className} mt-2 text-[16px] leading-relaxed text-white/90`}>{children}</div>
    </div>
  );
}

/** Blank lines in the admin start a new paragraph, as everywhere else in the zone. */
function Paragraphs({ text }: { text: string }) {
  return (
    <div className="space-y-2">
      {text
        .split(/\n\s*\n/)
        .map((p) => p.trim())
        .filter(Boolean)
        .map((p, i) => (
          <p key={i}>{p}</p>
        ))}
    </div>
  );
}

function ServiceNote() {
  return <p className={`${readFont.className} mt-6 text-[13px] leading-relaxed text-white/45`}>{COPY.serviceNote}</p>;
}

function Missing({ onBack }: { onBack: () => void }) {
  return (
    <Stage screenKey="missing">
      <DialogueBox>
        <p className={`${readFont.className} text-white/85`}>That cocktail isn&apos;t on the menu any more.</p>
      </DialogueBox>
      <Choices>
        <Choice primary onClick={onBack}>
          {COPY.backToHost}
        </Choice>
      </Choices>
    </Stage>
  );
}
