"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { getGameMeta } from "@/lib/popup/games";
import { getGameComponent } from "./registry";
import { P, pad } from "./arcade";
import type { GameBoard } from "@/lib/popup/types";

type Phase = "attract" | "playing" | "over";

export interface GameShellProps {
  menuId: string;
  cocktailId: string;
  cocktailName: string;
  gameKey: string;
  /** Signed-in guest's id, or null. Scores only save for a signed-in guest. */
  viewerId: string | null;
  /** Only a confirmed email can actually be sent a gift card. */
  emailVerified: boolean;
  /** False once the pop-up has closed — the board is then frozen. */
  scoringOpen: boolean;
  isSandbox?: boolean;
  accent?: string;
  /** Skip the attract screen — used when the player asked for the game itself. */
  autoStart?: boolean;
  /**
   * Where "quit" goes. Without it the cabinet falls back to its own attract
   * screen; with it, leaving the game closes whatever opened it.
   */
  onExit?: () => void;
}

/**
 * The cabinet around a mini game: attract screen, the game itself, then the
 * score, where it landed on the board, and the way back in for another go.
 *
 * Every game gets this for free — a new game is just a component plus a
 * registry entry, exactly like the pop-up templates.
 */
export default function GameShell({
  menuId,
  cocktailId,
  cocktailName,
  gameKey,
  viewerId,
  emailVerified,
  scoringOpen,
  isSandbox = false,
  accent = P.yellow,
  autoStart = false,
  onExit,
}: GameShellProps) {
  const meta = getGameMeta(gameKey);
  const Game = getGameComponent(gameKey);

  const [phase, setPhase] = useState<Phase>(autoStart ? "playing" : "attract");
  const [score, setScore] = useState(0);
  const [board, setBoard] = useState<GameBoard | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedThisRun, setSavedThisRun] = useState(false);
  const [paused, setPaused] = useState(false);

  const loadBoard = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/popup/score?menuId=${encodeURIComponent(menuId)}&gameKey=${encodeURIComponent(gameKey)}${isSandbox ? "&sandbox=1" : ""}`
      );
      if (!res.ok) return;
      const data = await res.json();
      setBoard(data.board ?? null);
    } catch {
      /* a missing board must never stop someone playing */
    }
  }, [menuId, gameKey, isSandbox]);

  useEffect(() => {
    if (meta) void loadBoard();
  }, [meta, loadBoard]);

  // ── Full-screen play ──────────────────────────────────────────────────────
  // A canvas game sitting in the page flow is unplayable: the page scrolls
  // under the player's thumb, and on a phone the cabinet is a stamp in the
  // middle of a long article. From the moment a round starts until they leave
  // the score screen, the cabinet owns the viewport.
  const fullscreen = phase === "playing" || phase === "over";

  useEffect(() => {
    if (!fullscreen) return;
    const body = document.body;
    const previous = body.style.overflow;
    body.style.overflow = "hidden";
    return () => {
      body.style.overflow = previous;
    };
  }, [fullscreen]);

  const leave = useCallback(() => {
    if (onExit) onExit();
    else setPhase("attract");
  }, [onExit]);

  // A pause never outlives the run it paused.
  useEffect(() => {
    if (phase !== "playing") setPaused(false);
  }, [phase]);

  // Escape pauses a run rather than abandoning it — one stray key should not
  // throw away a high score. On the score screen it still closes.
  useEffect(() => {
    if (!fullscreen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      if (phase === "playing") setPaused((p) => !p);
      else leave();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [fullscreen, phase, leave]);

  // A phone that locks, or a guest who switches to their messages, comes back
  // to a pause screen rather than to a run that carried on — or died — without
  // them.
  useEffect(() => {
    if (phase !== "playing") return;
    function onVisibility() {
      if (document.hidden) setPaused(true);
    }
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [phase]);

  const handleGameOver = useCallback(
    async (finalScore: number, detail?: Record<string, unknown>) => {
      setScore(finalScore);
      setPhase("over");
      setSavedThisRun(false);
      setSaveError(null);

      if (!viewerId || !scoringOpen) return;

      setSaving(true);
      try {
        const res = await fetch("/api/popup/score", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            menuId,
            cocktailId,
            gameKey,
            score: finalScore,
            detail: detail ?? {},
            sandbox: isSandbox,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          setSaveError(data.error ?? "Could not save your score.");
          return;
        }
        setBoard(data.board ?? null);
        setSavedThisRun(true);
      } catch {
        setSaveError("Network error — your score wasn't saved.");
      } finally {
        setSaving(false);
      }
    },
    [viewerId, scoringOpen, menuId, cocktailId, gameKey, isSandbox]
  );

  if (!meta || !Game) {
    return (
      <div className="border-2 border-white/20 bg-black p-8 text-center">
        <p className="text-[11px] tracking-[0.25em] uppercase text-white/50">Game coming soon</p>
        <p className="mt-3 text-xs text-white/35 leading-relaxed">
          {cocktailName} doesn&apos;t have its game yet. Check back — we&apos;re building it.
        </p>
      </div>
    );
  }

  // ── Playing: the whole screen ─────────────────────────────────────────────
  // Every game gets the viewport while it is being played — no marquee, no
  // border, no bezel. The frame was spending a phone's screen on decoration
  // around the one thing the guest is looking at.
  //
  // The only chrome is a small pause button in the top-right corner. The
  // full-bleed games keep that corner clear of their HUD (EXIT_CLEARANCE in
  // TikiWars.tsx, the same idea in the others), and a pause is one tap away
  // from the way out without a stray tap ever ending a run.
  if (phase === "playing") {
    return (
      <div className="fixed inset-0 z-[70] bg-black">
        <Game
          onGameOver={handleGameOver}
          menuId={menuId}
          viewerId={viewerId}
          paused={paused}
          onShowScores={() => setPhase("attract")}
        />
        {paused ? (
          <PauseScreen
            title={meta.title}
            accent={accent}
            onResume={() => setPaused(false)}
            onExit={leave}
          />
        ) : (
          <button
            onClick={() => setPaused(true)}
            aria-label="Pause"
            // 44px to hit, a smaller mark to see — it sits over the game's art.
            className="absolute top-1 right-1 z-10 flex h-11 w-11 items-center justify-center"
            style={{ WebkitTapHighlightColor: "transparent" }}
          >
            <span className="flex h-8 w-8 items-center justify-center gap-[3px] rounded-full border border-white/35 bg-black/55 backdrop-blur-sm active:bg-black/80">
              <span className="block h-3 w-[3px] rounded-sm bg-white/90" />
              <span className="block h-3 w-[3px] rounded-sm bg-white/90" />
            </span>
          </button>
        )}
      </div>
    );
  }

  // ── Game over: the whole screen too, and the way out ──────────────────────
  if (phase === "over") {
    return (
      <div className="fixed inset-0 z-[70] bg-black overflow-y-auto overscroll-contain">
        <div className="min-h-full flex flex-col items-center justify-center p-4">
          <div className="w-full max-w-[420px]">
            <p style={{ color: accent }} className="text-center text-[11px] tracking-[0.3em] uppercase font-bold">
              {meta.title}
            </p>
            <GameOverScreen
              score={score}
              board={board}
              accent={accent}
              saving={saving}
              saved={savedThisRun}
              saveError={saveError}
              scoringOpen={scoringOpen}
              viewerId={viewerId}
              emailVerified={emailVerified}
              onReplay={() => setPhase("playing")}
              onQuit={leave}
            />
          </div>
        </div>
      </div>
    );
  }

  // ── Attract: the cabinet, in the page ─────────────────────────────────────
  return (
    <div className="w-full mx-auto max-w-[420px]">
      <div
        style={{ borderColor: accent }}
        className="border-2 border-b-0 bg-black px-3 py-2 text-center"
      >
        <p style={{ color: accent }} className="text-[11px] tracking-[0.3em] uppercase font-bold">
          {meta.title}
        </p>
      </div>
      <div style={{ borderColor: accent }} className="border-2 bg-black">
        <AttractScreen
          meta={meta}
          board={board}
          accent={accent}
          scoringOpen={scoringOpen}
          viewerId={viewerId}
          emailVerified={emailVerified}
          onStart={() => setPhase("playing")}
        />
      </div>
    </div>
  );
}

// ─── Pause ───────────────────────────────────────────────────────────────────

/**
 * Over the frozen game, so the guest can see where they left it. Resume is the
 * big button — it is what nearly everyone opened this for.
 */
function PauseScreen({
  title,
  accent,
  onResume,
  onExit,
}: {
  title: string;
  accent: string;
  onResume: () => void;
  onExit: () => void;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Paused"
      className="absolute inset-0 z-20 flex items-center justify-center bg-black/75 backdrop-blur-[2px] p-6"
      // Swallow every touch, so nothing reaches the game underneath.
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div className="w-full max-w-[300px] text-center">
        <p className="text-[10px] tracking-[0.3em] uppercase text-white/50">{title}</p>
        <p style={{ color: accent }} className="mt-2 text-3xl font-bold tracking-[0.2em] uppercase">
          Paused
        </p>
        <button
          onClick={onResume}
          autoFocus
          style={{ background: accent }}
          className="mt-8 w-full py-4 text-black text-xs tracking-[0.3em] uppercase font-bold active:opacity-80"
        >
          Resume
        </button>
        <button
          onClick={onExit}
          className="mt-3 w-full py-3.5 border-2 border-white/25 text-white/75 text-[11px] tracking-[0.25em] uppercase active:bg-white/10"
        >
          Exit
        </button>
      </div>
    </div>
  );
}

// ─── Attract mode ────────────────────────────────────────────────────────────

function AttractScreen({
  meta,
  board,
  accent,
  scoringOpen,
  viewerId,
  emailVerified,
  onStart,
}: {
  meta: NonNullable<ReturnType<typeof getGameMeta>>;
  board: GameBoard | null;
  accent: string;
  scoringOpen: boolean;
  viewerId: string | null;
  emailVerified: boolean;
  onStart: () => void;
}) {
  return (
    <div className="p-4 sm:p-5">
      <p className="text-center text-[10px] tracking-[0.2em] uppercase text-white/45">
        {meta.blurb}
      </p>

      <ol className="mt-4 space-y-1.5">
        {meta.howToPlay.map((line, i) => (
          <li key={i} className="flex gap-2.5 text-[11px] text-white/70 leading-relaxed">
            <span style={{ color: accent }} className="tabular-nums shrink-0">
              {i + 1}
            </span>
            <span>{line}</span>
          </li>
        ))}
      </ol>

      <PrizeNotice
        accent={accent}
        scoringOpen={scoringOpen}
        viewerId={viewerId}
        emailVerified={emailVerified}
      />

      <button
        onClick={onStart}
        style={{ background: accent }}
        className="mt-4 w-full py-4 text-black text-xs tracking-[0.3em] uppercase font-bold active:opacity-80 transition-opacity"
      >
        Press Start
      </button>

      {board && board.entries.length > 0 && (
        <div className="mt-5">
          <BoardTable board={board} accent={accent} />
        </div>
      )}
    </div>
  );
}

// ─── Game over ───────────────────────────────────────────────────────────────

function GameOverScreen({
  score,
  board,
  accent,
  saving,
  saved,
  saveError,
  scoringOpen,
  viewerId,
  emailVerified,
  onReplay,
  onQuit,
}: {
  score: number;
  board: GameBoard | null;
  accent: string;
  saving: boolean;
  saved: boolean;
  saveError: string | null;
  scoringOpen: boolean;
  viewerId: string | null;
  emailVerified: boolean;
  onReplay: () => void;
  onQuit: () => void;
}) {
  const beatBest = saved && board?.yourBest === score;

  return (
    <div className="p-4 sm:p-5">
      <p className="text-center text-xs tracking-[0.3em] uppercase text-white/60">Game Over</p>

      <p
        style={{ color: accent }}
        className="mt-3 text-center text-4xl tabular-nums font-bold tracking-wider"
      >
        {pad(score)}
      </p>

      {saving && (
        <p className="mt-2 text-center text-[10px] tracking-widest uppercase text-white/40">
          Saving…
        </p>
      )}

      {saved && board?.yourPosition != null && (
        <p className="mt-2 text-center text-[10px] tracking-widest uppercase text-white/60">
          {beatBest ? "New personal best · " : ""}Rank #{board.yourPosition} of {board.totalPlayers}
        </p>
      )}

      {saveError && <p className="mt-2 text-center text-[11px] text-red-300">{saveError}</p>}

      {!viewerId && scoringOpen && (
        <p className="mt-3 text-center text-[11px] text-white/50 leading-relaxed">
          Nice run — but it wasn&apos;t saved.{" "}
          <Link href="/popup/signup" style={{ color: accent }} className="underline">
            Make an account
          </Link>{" "}
          to get on the board.
        </p>
      )}

      {viewerId && saved && !emailVerified && (
        <p className="mt-3 text-center text-[11px] text-amber-200/80 leading-relaxed">
          Your score counts, but you&apos;ll need to confirm your email to be sent a gift card.{" "}
          <Link href="/popup/account" className="underline">
            Confirm now
          </Link>
        </p>
      )}

      {!scoringOpen && (
        <p className="mt-3 text-center text-[11px] text-white/45 leading-relaxed">
          This pop-up has closed — the board is final. Play for fun.
        </p>
      )}

      <div className="mt-4 grid grid-cols-2 gap-2">
        <button
          onClick={onReplay}
          style={{ background: accent }}
          className="py-3.5 text-black text-[11px] tracking-[0.2em] uppercase font-bold active:opacity-80"
        >
          Play Again
        </button>
        <button
          onClick={onQuit}
          className="py-3.5 border-2 border-white/25 text-white/70 text-[11px] tracking-[0.2em] uppercase active:bg-white/10"
        >
          Exit
        </button>
      </div>

      {board && board.entries.length > 0 && (
        <div className="mt-5">
          <BoardTable board={board} accent={accent} />
        </div>
      )}
    </div>
  );
}

// ─── Shared bits ─────────────────────────────────────────────────────────────

function PrizeNotice({
  accent,
  scoringOpen,
  viewerId,
  emailVerified,
}: {
  accent: string;
  scoringOpen: boolean;
  viewerId: string | null;
  emailVerified: boolean;
}) {
  if (!scoringOpen) {
    return (
      <p className="mt-4 border border-white/15 px-3 py-2.5 text-center text-[10px] leading-relaxed text-white/45">
        This pop-up has closed. The board below is final.
      </p>
    );
  }

  return (
    <div
      style={{ borderColor: accent }}
      className="mt-4 border px-3 py-2.5 text-center leading-relaxed"
    >
      <p style={{ color: accent }} className="text-[10px] tracking-[0.2em] uppercase font-bold">
        High score wins a $15 gift card
      </p>
      <p className="mt-1 text-[10px] text-white/50">
        Top score on this game when the pop-up ends gets emailed a $15 digital gift card.
      </p>
      {!viewerId ? (
        <p className="mt-1.5 text-[10px] text-white/40">
          <Link href="/popup/signup" className="underline">
            Sign up
          </Link>{" "}
          to put your score on the board.
        </p>
      ) : !emailVerified ? (
        <p className="mt-1.5 text-[10px] text-amber-200/70">
          Confirm your email to be eligible for the prize.
        </p>
      ) : null}
    </div>
  );
}

function BoardTable({ board, accent }: { board: GameBoard; accent: string }) {
  return (
    <>
      <p className="text-center text-[10px] tracking-[0.3em] uppercase text-white/45 mb-2">
        High Scores
      </p>
      <ol className="space-y-0.5">
        {board.entries.map((e, i) => (
          <li
            key={`${e.name}-${i}`}
            style={e.isYou ? { color: accent } : undefined}
            className={`flex items-center gap-2 px-2 py-1 text-[11px] tabular-nums ${
              e.isYou ? "bg-white/10" : "text-white/70"
            }`}
          >
            <span className="w-5 shrink-0 opacity-60">{e.position}</span>
            <span className="flex-1 min-w-0 truncate">{e.name}</span>
            <span className="shrink-0 font-bold">{pad(e.score)}</span>
          </li>
        ))}
      </ol>
      {board.yourBest != null &&
        !board.entries.some((e) => e.isYou) && (
          <p style={{ color: accent }} className="mt-2 text-center text-[10px] tabular-nums">
            Your best: {pad(board.yourBest)} · rank #{board.yourPosition}
          </p>
        )}
    </>
  );
}
