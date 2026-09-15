"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ArcadeGameProps } from "../registry";
import { isRenderable } from "../arcade";
import CabButton from "../../cabinet/CabButton";
import { pixelFont } from "../../cabinet/pixelArt";
import { C } from "../../cabinet/theme";
import StickCanvas from "./StickCanvas";
import { warmArt } from "./art";
import { newBot, botStep, type Bot } from "./bot";
import { MAX_PLAYERS, MIN_PARTY_PLAYERS, NAME_MAX } from "./constants";
import {
  freshState,
  pointerDown,
  pointerMove,
  pointerUp,
  runDetail,
  setWidth,
  update,
  type Mode,
  type State,
} from "./core";
import { drawFrame } from "./draw";
import { HowToSlides, TitleScreen } from "./Intro";

// ═══════════════════════════════════════════════════════════════════════════
// BEHIND THE STICK
//
// Sideways, a thumb on each side, several things at once — like a real rush.
// Grab the order's bottles as they fall, play the build down the highway,
// then shake or stir it with one thumb while the next order rains down on the
// other. WarioWare micro games cut in along the way.
//
// SOLO: three lives. PARTY: up to ten names, a last-one-standing relay on its
// own leaderboard — every served drink passes the phone to someone random,
// a strike knocks you out, and the team's combined score is what counts.
//
// Rules live in core.ts, drawing in draw.ts. This file is the setup screens,
// the phone-orientation handling, and the frame loop that ties them together.
// ═══════════════════════════════════════════════════════════════════════════

const ROTATE_KEY = "bts-play-sideways";
const NAMES_KEY = "bts-party-names";

/** Only characters the in-game bitmap font can draw. */
function cleanName(raw: string): string {
  return raw
    .toUpperCase()
    .replace(/[^A-Z0-9 .!?'-]/g, "")
    .replace(/\s+/g, " ")
    .slice(0, NAME_MAX);
}

/** Trimmed, non-empty, and unique — a second "MIKE" becomes "MIKE 2". */
function finalNames(raw: string[]): string[] {
  const seen = new Map<string, number>();
  const out: string[] = [];
  for (const r of raw) {
    const n = cleanName(r).trim();
    if (!n || !isRenderable(n)) continue;
    const count = (seen.get(n) ?? 0) + 1;
    seen.set(n, count);
    out.push(count > 1 ? `${n.slice(0, NAME_MAX - 2)} ${count}` : n);
  }
  return out.slice(0, MAX_PLAYERS);
}

function readStored<T>(key: string, fallback: T): T {
  try {
    const v = window.localStorage.getItem(key);
    return v ? (JSON.parse(v) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeStored(key: string, value: unknown) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* private mode — the setting just won't be remembered */
  }
}

/**
 * Best effort at holding the phone sideways. Android honours this once the page
 * is full screen; iPhones allow neither, which is what the rotate prompt and
 * the play-sideways-anyway fallback are for.
 */
async function tryLockLandscape(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  if (!window.matchMedia?.("(pointer: coarse)").matches) return false;
  try {
    const el = document.documentElement;
    if (!document.fullscreenElement && el.requestFullscreen) await el.requestFullscreen({ navigationUI: "hide" });
    const orientation = screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> };
    if (orientation?.lock) await orientation.lock("landscape");
    return true;
  } catch {
    return Boolean(document.fullscreenElement);
  }
}

function releaseLandscape() {
  try {
    const orientation = screen.orientation as ScreenOrientation & { unlock?: () => void };
    orientation?.unlock?.();
    if (document.fullscreenElement) void document.exitFullscreen();
  } catch {
    /* nothing to undo */
  }
}

export default function BehindTheStick({ onGameOver, demo = false, paused = false }: ArcadeGameProps) {
  const [screenName, setScreenName] = useState<"title" | "party" | "howto" | "play">(demo ? "play" : "title");
  const [mode, setMode] = useState<Mode>("solo");
  const [party, setParty] = useState<string[]>([]);
  const [names, setNames] = useState<string[]>(["", ""]);
  const [sideways, setSideways] = useState(false);
  const [portrait, setPortrait] = useState(false);

  const rootRef = useRef<HTMLDivElement | null>(null);
  const stRef = useRef<State | null>(null);
  const botRef = useRef<Bot>(newBot());
  const reported = useRef(false);
  const locked = useRef(false);
  const onGameOverRef = useRef(onGameOver);
  onGameOverRef.current = onGameOver;

  useEffect(() => {
    warmArt();
    setSideways(readStored(ROTATE_KEY, false));
    const stored = readStored<string[]>(NAMES_KEY, []);
    if (Array.isArray(stored) && stored.length >= MIN_PARTY_PLAYERS) setNames(stored.map(cleanName));
  }, []);

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const check = () => {
      const r = el.getBoundingClientRect();
      setPortrait(r.height > r.width);
    };
    check();
    const ro = new ResizeObserver(check);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (demo) stRef.current = freshState({ demo: true });
    return () => {
      if (locked.current) releaseLandscape();
    };
  }, [demo]);

  const start = useCallback((mode: Mode, party: string[] = []) => {
    // Called straight from the tap, which is the only moment a browser allows
    // going full screen.
    void tryLockLandscape().then((ok) => {
      locked.current = ok;
    });
    reported.current = false;
    stRef.current = freshState({ mode, names: party });
    setScreenName("play");
  }, []);

  const blocked = !demo && screenName === "play" && portrait && !sideways;

  const onFrame = useCallback(
    (ctx: CanvasRenderingContext2D, dt: number, w: number, s: number) => {
      const st = stRef.current;
      if (!st) return;
      setWidth(st, w);
      if (!blocked) {
        if (demo) botStep(botRef.current, st, dt);
        const { finished } = update(st, dt);
        if (finished) {
          if (demo) {
            stRef.current = freshState({ demo: true });
            botRef.current = newBot();
          } else if (!reported.current) {
            reported.current = true;
            onGameOverRef.current(st.score, runDetail(st));
          }
        }
      }
      drawFrame(ctx, st, s, st.t);
    },
    [blocked, demo]
  );

  const pointer = {
    down: (id: number, x: number, y: number) => {
      if (!demo && stRef.current && !blocked) pointerDown(stRef.current, id, x, y);
    },
    move: (id: number, x: number, y: number) => {
      if (!demo && stRef.current) pointerMove(stRef.current, id, x, y);
    },
    up: (id: number) => {
      if (!demo && stRef.current) pointerUp(stRef.current, id);
    },
  };

  return (
    <div ref={rootRef} className={`relative w-full h-full bg-black ${pixelFont.className}`}>
      {screenName === "play" ? (
        <StickCanvas
          onFrame={onFrame}
          running={!paused}
          rotate={!demo && sideways}
          pointer={pointer}
        />
      ) : screenName === "title" ? (
        <TitleScreen
          onPick={(m) => {
            setMode(m);
            setScreenName(m === "party" ? "party" : "howto");
          }}
        />
      ) : screenName === "party" ? (
        <PartyScreen
          names={names}
          setNames={setNames}
          onBack={() => setScreenName("title")}
          onStart={() => {
            const final = finalNames(names);
            writeStored(NAMES_KEY, final);
            setParty(final);
            setScreenName("howto");
          }}
        />
      ) : (
        <HowToSlides
          mode={mode}
          names={party}
          onBack={() => setScreenName(mode === "party" ? "party" : "title")}
          onDone={() => start(mode, mode === "party" ? party : [])}
        />
      )}

      {blocked && (
        <RotatePrompt
          onSideways={() => {
            setSideways(true);
            writeStored(ROTATE_KEY, true);
          }}
        />
      )}
    </div>
  );
}

// ─── Screens ─────────────────────────────────────────────────────────────────

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="absolute inset-0 overflow-y-auto overscroll-contain"
      style={{
        background: `radial-gradient(circle at 50% 20%, ${C.plum} 0%, ${C.grapeDeep} 70%)`,
      }}
    >
      <div className="min-h-full flex flex-col items-center justify-center px-5 py-10">
        <div className="w-full max-w-[420px] text-center">{children}</div>
      </div>
    </div>
  );
}

function PartyScreen({
  names,
  setNames,
  onBack,
  onStart,
}: {
  names: string[];
  setNames: (n: string[]) => void;
  onBack: () => void;
  onStart: () => void;
}) {
  const ready = finalNames(names).length >= MIN_PARTY_PLAYERS;
  const edit = (i: number, v: string) => setNames(names.map((n, j) => (j === i ? cleanName(v) : n)));

  return (
    <Frame>
      <h2 className="text-[16px]" style={{ color: C.gold, textShadow: "3px 3px 0 #000" }}>
        Who&apos;s Playing?
      </h2>
      <p className="mt-3 text-[8px] leading-relaxed" style={{ color: C.cream, opacity: 0.7 }}>
        The game picks who goes next. Keep the phone moving!
      </p>

      <ol className="mt-6 flex flex-col gap-2">
        {names.map((n, i) => (
          <li key={i} className="flex items-center gap-2">
            <span className="w-6 text-[9px] shrink-0" style={{ color: C.gold }}>
              {i + 1}
            </span>
            <input
              value={n}
              onChange={(e) => edit(i, e.target.value)}
              maxLength={NAME_MAX}
              placeholder={`Bartender ${i + 1}`}
              autoCapitalize="characters"
              autoComplete="off"
              spellCheck={false}
              enterKeyHint="next"
              className="flex-1 min-w-0 px-3 py-2.5 text-[11px] uppercase outline-none placeholder:normal-case placeholder:opacity-40"
              style={{ background: C.ink, color: C.cream, border: `3px solid ${C.plum}`, fontFamily: "inherit" }}
            />
            {names.length > MIN_PARTY_PLAYERS && (
              <button
                type="button"
                aria-label={`Remove player ${i + 1}`}
                onClick={() => setNames(names.filter((_, j) => j !== i))}
                className="w-9 h-9 shrink-0 text-[10px]"
                style={{ background: C.plum, color: C.cream, border: `3px solid ${C.ink}` }}
              >
                X
              </button>
            )}
          </li>
        ))}
      </ol>

      {names.length < MAX_PLAYERS && (
        <CabButton color={C.teal} size="sm" className="mt-3 w-full" onClick={() => setNames([...names, ""])}>
          + Add Bartender
        </CabButton>
      )}

      <div className="mt-6 grid grid-cols-[1fr_2fr] gap-2">
        <CabButton color={C.plum} size="md" className="w-full" onClick={onBack}>
          Back
        </CabButton>
        <CabButton color={C.gold} size="md" className="w-full" disabled={!ready} onClick={onStart}>
          Next
        </CabButton>
      </div>
      {!ready && (
        <p className="mt-3 text-[8px]" style={{ color: C.cream, opacity: 0.5 }}>
          Enter at least two names.
        </p>
      )}
    </Frame>
  );
}

function RotatePrompt({ onSideways }: { onSideways: () => void }) {
  return (
    <div
      role="dialog"
      aria-label="Rotate your phone"
      className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-6 px-8 text-center"
      style={{ background: "rgba(10,4,16,0.94)" }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div
        className="w-16 h-28 rounded-lg"
        style={{
          border: `4px solid ${C.cream}`,
          animation: "bts-turn 1.8s ease-in-out infinite",
        }}
      />
      <style>{`@keyframes bts-turn { 0%,25% { transform: rotate(0deg) } 60%,100% { transform: rotate(-90deg) } }`}</style>
      <p className="text-[16px] leading-snug" style={{ color: C.gold, textShadow: "3px 3px 0 #000" }}>
        Rotate Your Phone
      </p>
      <p className="text-[9px] leading-relaxed" style={{ color: C.cream, opacity: 0.8 }}>
        Behind the Stick is played sideways, with a thumb on each side.
      </p>
      <div className="w-full max-w-[300px] flex flex-col gap-2">
        <CabButton color={C.teal} size="sm" className="w-full" onClick={onSideways}>
          My Screen Won&apos;t Turn
        </CabButton>
        <p className="text-[8px] leading-relaxed" style={{ color: C.cream, opacity: 0.5 }}>
          Rotation lock on? Tap that and we&apos;ll draw the game sideways. Turn the phone so its
          right edge points up.
        </p>
      </div>
    </div>
  );
}
