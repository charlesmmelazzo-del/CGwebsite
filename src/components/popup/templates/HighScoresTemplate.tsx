"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import GameShell from "../games/GameShell";
import StartScreen from "../StartScreen";
import CocktailCarousel from "../cabinet/CocktailCarousel";
import CabButton from "../cabinet/CabButton";
import CrtPanel from "../cabinet/CrtPanel";
import { artLayer, pixelFont, UI } from "../cabinet/pixelArt";
import { C, withAlpha } from "../cabinet/theme";
import type { PopupCocktail, PopupTemplateProps } from "@/lib/popup/types";

/**
 * HIGH SCORES — a golden-age arcade pop-up.
 *
 * The whole page is dressed as a room full of cabinets, and each cocktail is a
 * screen in a carousel: its name, its game playing itself, and two ways in.
 *
 *   FREE PLAY       — anyone, any time, nothing recorded.
 *   HIGH SCORE RUN  — a signed-in guest spends the raffle ticket that came with
 *                     their cocktail on one run that counts for the prize. That
 *                     is what stops someone replaying at home all week to win.
 *
 * Built mobile-first throughout, because nearly everyone meets this standing at
 * the bar with a phone in one hand and a drink in the other.
 */

/** What's running full screen: which game, and whether it counts. */
interface Play {
  cocktailId: string;
  freePlay: boolean;
  runId: string | null;
}

/** Query param that reopens the ticket prompt after signing in or up. */
const RUN_PARAM = "run";

export default function HighScoresTemplate({
  menu,
  cocktails,
  viewer,
  isLive,
  isSandbox,
}: PopupTemplateProps) {
  const [play, setPlay] = useState<Play | null>(null);
  const playing = cocktails.find((c) => c.id === play?.cocktailId) ?? null;

  // The two prompts in front of a High Score Run.
  const [signInFor, setSignInFor] = useState<PopupCocktail | null>(null);
  const [ticketFor, setTicketFor] = useState<PopupCocktail | null>(null);

  // The attract screen, shown on EVERY load rather than once per session. It
  // carries the logo, what the pop-up is, and the prize, so none of that has to
  // sit permanently above the cocktails taking up the screen.
  const [started, setStarted] = useState(false);
  const [startIndex, setStartIndex] = useState(0);

  const startHighScoreRun = useCallback(
    (cocktail: PopupCocktail) => {
      setPlay(null);
      // The sandbox has no tickets — the owner tests the real flow otherwise.
      if (isSandbox) setPlay({ cocktailId: cocktail.id, freePlay: false, runId: null });
      else if (!viewer) setSignInFor(cocktail);
      else setTicketFor(cocktail);
    },
    [isSandbox, viewer]
  );

  // Back from signing in to play a particular game: skip the attract screen,
  // land on that game, and ask for the ticket straight away.
  const handledReturn = useRef(false);
  useEffect(() => {
    if (handledReturn.current) return;
    handledReturn.current = true;
    const url = new URL(window.location.href);
    const id = url.searchParams.get(RUN_PARAM);
    if (!id) return;
    url.searchParams.delete(RUN_PARAM);
    window.history.replaceState(null, "", url.pathname + url.search + url.hash);

    const index = cocktails.findIndex((c) => c.id === id);
    if (index < 0) return;
    setStarted(true);
    setStartIndex(index);
    if (viewer && isLive) setTicketFor(cocktails[index]);
  }, [cocktails, viewer, isLive]);

  return (
    // Fills the screen under the zone bar (48px plus its 1px rule) and no more,
    // so the page never scrolls.
    <div className="min-h-[calc(100dvh-49px)] bg-[#05030F] text-white relative overflow-hidden">
      <ArcadeBackdrop />

      <div className="relative px-1 sm:px-6 py-3 sm:py-6">
        {!isLive && (
          <p
            className="mb-3 text-center text-[10px] tracking-[0.25em] uppercase"
            style={{ color: C.magenta }}
          >
            ★ This pop-up has closed — boards are final ★
          </p>
        )}

        {cocktails.length === 0 ? (
          <p className="text-center text-sm text-white/40 py-16">
            No cocktails on this pop-up yet.
          </p>
        ) : (
          <CocktailCarousel
            cocktails={cocktails}
            scoringOpen={isLive}
            startIndex={startIndex}
            onFreePlay={(id) => setPlay({ cocktailId: id, freePlay: true, runId: null })}
            onHighScoreRun={(id) => {
              const c = cocktails.find((x) => x.id === id);
              if (c) startHighScoreRun(c);
            }}
          />
        )}
      </div>

      {!started && (
        <StartScreen onStart={() => setStarted(true)} />
      )}

      {playing?.gameKey && play && (
        <GameShell
          // A new ticket is a new cabinet: fresh score, fresh "spent" state.
          key={`${playing.id}:${play.freePlay ? "free" : play.runId ?? "sandbox"}`}
          menuId={menu.id}
          cocktailId={playing.id}
          cocktailName={playing.name}
          gameKey={playing.gameKey}
          viewerId={viewer?.userId ?? null}
          emailVerified={viewer?.emailVerified ?? false}
          scoringOpen={isLive}
          isSandbox={isSandbox}
          freePlay={play.freePlay}
          runId={play.runId}
          onNewRun={() => startHighScoreRun(playing)}
          accent="#FFD500"
          autoStart
          onExit={() => setPlay(null)}
        />
      )}

      {signInFor && (
        <SignInPrompt cocktail={signInFor} onCancel={() => setSignInFor(null)} />
      )}

      {ticketFor && (
        <TicketPrompt
          menuId={menu.id}
          cocktail={ticketFor}
          onCancel={() => setTicketFor(null)}
          onRedeemed={(runId) => {
            setTicketFor(null);
            setPlay({ cocktailId: ticketFor.id, freePlay: false, runId });
          }}
        />
      )}
    </div>
  );
}

// ─── Prompts ─────────────────────────────────────────────────────────────────

/**
 * A lit cabinet screen floating over everything. Sits above a running game
 * (z-70) because "New Run" on the score screen opens the ticket prompt, and
 * below the attract screen (z-80).
 */
function PromptFrame({
  label,
  title,
  onCancel,
  children,
}: {
  label: string;
  title: string;
  onCancel: () => void;
  children: React.ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onCancel();
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onCancel]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-[75] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto"
      onClick={onCancel}
    >
      <div className="w-full max-w-sm text-center" onClick={(e) => e.stopPropagation()}>
        <CrtPanel accents={false} glow={C.gold}>
          <p className={`${pixelFont.className} text-[8px] tracking-[0.2em] uppercase`} style={{ color: C.teal }}>
            {label}
          </p>
          <h2
            className="mt-2 text-2xl sm:text-3xl font-black uppercase tracking-tight leading-none"
            style={{
              fontFamily: "var(--font-display, system-ui)",
              color: C.gold,
              textShadow: `0 0 14px ${withAlpha(C.gold, 0.5)}, 3px 4px 0 ${C.ink}`,
            }}
          >
            {title}
          </h2>
          {children}
        </CrtPanel>
      </div>
    </div>
  );
}

function SignInPrompt({ cocktail, onCancel }: { cocktail: PopupCocktail; onCancel: () => void }) {
  const router = useRouter();
  // Come back to this exact game, with the ticket prompt already open.
  const back = `${typeof window === "undefined" ? "/popup" : window.location.pathname}?${RUN_PARAM}=${cocktail.id}`;
  const from = encodeURIComponent(back);

  return (
    <PromptFrame label="High Score Run" title={cocktail.name} onCancel={onCancel}>
      <p className="mt-5 text-sm leading-relaxed" style={{ color: withAlpha(C.cream, 0.8) }}>
        High Score Runs need a player account, so we know who to send your prize to.
      </p>
      <p className="mt-2 text-xs leading-relaxed" style={{ color: withAlpha(C.cream, 0.5) }}>
        One account works for this pop-up and every one after it.
      </p>

      <div className="mt-6 flex flex-col gap-4">
        <CabButton
          color={C.magenta}
          size="md"
          className="w-full"
          onClick={() => router.push(`/popup/signup?from=${from}`)}
        >
          Create Account
        </CabButton>
        <CabButton
          color={C.teal}
          size="md"
          className="w-full"
          onClick={() => router.push(`/popup/login?from=${from}`)}
        >
          Sign In
        </CabButton>
      </div>

      <div className="mt-4">
        <CabButton color={C.plum} size="sm" onClick={onCancel}>
          Not now
        </CabButton>
      </div>
    </PromptFrame>
  );
}

function TicketPrompt({
  menuId,
  cocktail,
  onCancel,
  onRedeemed,
}: {
  menuId: string;
  cocktail: PopupCocktail;
  onCancel: () => void;
  onRedeemed: (runId: string) => void;
}) {
  const [serial, setSerial] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** Set once the ticket is accepted: it tears, then the run starts. */
  const [torn, setTorn] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!serial.trim() || busy || torn) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/popup/ticket", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ menuId, cocktailId: cocktail.id, serial }),
      });
      const data = await res.json();
      if (!res.ok || !data.runId) {
        setError(data.error ?? "That ticket didn't work. Try again.");
        return;
      }
      setTorn(true);
      window.setTimeout(() => onRedeemed(String(data.runId)), 750);
    } catch {
      setError("Network error — check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  const box = UI.ticket.box;

  return (
    <PromptFrame label="High Score Run" title={cocktail.name} onCancel={onCancel}>
      <form onSubmit={submit}>
        <p className="mt-5 text-sm leading-relaxed" style={{ color: withAlpha(C.cream, 0.85) }}>
          Enter the code from the ticket included with your cocktail.
        </p>
        <p
          className={`${pixelFont.className} mt-3 text-[9px] uppercase leading-relaxed`}
          style={{ color: C.gold }}
        >
          One ticket = 1 play
        </p>

        {/* The ticket itself, with the number typed into its dark box. */}
        <div
          // Two screen pixels per art pixel on a phone, three from `sm` up —
          // whole numbers, so the ticket's pixels stay even.
          className={`relative mx-auto mt-5 w-[200px] sm:w-[300px] ${torn ? "animate-[ticket-tear_0.35s_steps(3)]" : ""}`}
          style={{
            aspectRatio: `${UI.ticket.width} / ${UI.ticket.height}`,
            ...artLayer(torn ? "ticket-torn" : "ticket"),
          }}
        >
          {!torn && (
            <input
              autoFocus
              inputMode="numeric"
              autoComplete="off"
              maxLength={16}
              aria-label="Ticket number"
              placeholder="# # # #"
              value={serial}
              onChange={(e) => {
                setSerial(e.target.value);
                setError(null);
              }}
              className={`${pixelFont.className} absolute bg-transparent text-center tabular-nums focus:outline-none placeholder:text-white/25`}
              style={{
                left: `${box.left}%`,
                top: `${box.top}%`,
                width: `${box.width}%`,
                height: `${box.height}%`,
                color: error ? "#FF6B6B" : C.gold,
                fontSize: serial.length > 8 ? 8 : 12,
                caretColor: C.gold,
              }}
            />
          )}
        </div>
        <style>{`@keyframes ticket-tear { 0% { transform: translateX(-3px) } 50% { transform: translateX(3px) } 100% { transform: none } }`}</style>

        {error && (
          <p className="mt-3 text-xs leading-relaxed" role="alert" style={{ color: "#FF6B6B" }}>
            {error}
          </p>
        )}

        <p className="mt-3 text-[10px] leading-relaxed" style={{ color: withAlpha(C.cream, 0.45) }}>
          {torn ? "Ticket accepted — get ready!" : "Your ticket is used as soon as the run starts."}
        </p>

        {/* A real submit button so the phone keyboard's "Go" starts the run. */}
        <div className="mt-5 flex flex-col items-center gap-3">
          <CabButton
            type="submit"
            color={C.magenta}
            size="md"
            className="w-full"
            disabled={busy || torn || !serial.trim()}
          >
            {busy ? "Checking…" : "Start Run"}
          </CabButton>
          <CabButton color={C.plum} size="sm" onClick={onCancel} disabled={torn}>
            Cancel
          </CabButton>
        </div>
      </form>
    </PromptFrame>
  );
}

// ─── Backdrop ────────────────────────────────────────────────────────────────

/** Deep field, a faint grid, and scanlines over the lot. */
function ArcadeBackdrop() {
  return (
    <>
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-0"
        style={{
          background:
            "radial-gradient(120% 90% at 50% 0%, #1B1040 0%, #0A0620 45%, #05030F 100%)",
        }}
      />
      {/* Perspective floor grid, as on every space-shooter cabinet side art */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-x-0 bottom-0 h-1/3 z-0 opacity-25"
        style={{
          backgroundImage:
            "linear-gradient(to right, rgba(60,224,224,0.35) 1px, transparent 1px), linear-gradient(to bottom, rgba(60,224,224,0.35) 1px, transparent 1px)",
          backgroundSize: "44px 44px",
          maskImage: "linear-gradient(to bottom, transparent, black)",
          WebkitMaskImage: "linear-gradient(to bottom, transparent, black)",
          transform: "perspective(220px) rotateX(58deg)",
          transformOrigin: "bottom",
        }}
      />
      {/* Scanlines across the whole page */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-0 opacity-[0.22]"
        style={{
          backgroundImage:
            "repeating-linear-gradient(to bottom, rgba(0,0,0,0) 0px, rgba(0,0,0,0) 2px, rgba(0,0,0,0.85) 3px, rgba(0,0,0,0.85) 4px)",
        }}
      />
    </>
  );
}
