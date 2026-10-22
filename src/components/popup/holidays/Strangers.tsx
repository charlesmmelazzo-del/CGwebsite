"use client";

// ─── Play with strangers ─────────────────────────────────────────────────────
// The bar-wide games: a hub (pick a game, see who's on, enter a name), the
// Daily Winners board (a tab per game), and the live game screens.

import { useCallback, useEffect, useRef, useState } from "react";
import type { RulesSection } from "@/lib/holidays/types";
import LetterGrid from "./LetterGrid";
import { useCountdown } from "./useRoom";
import { BackLink, COLORS, HandBox, HandButton, handFont, Label, readFont, ScriptTitle, scriptFont, Squiggle, Star, Write } from "./ui";

// ─── Talking to the server ───────────────────────────────────────────────────

const TOKEN_KEY = (game: string) => `hh-pub-${game}`;
const NAME_KEY = "hh-pub-name";

function store(key: string, value?: string | null): string | null {
  try {
    if (value === undefined) return localStorage.getItem(key);
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    // Private browsing: today's score just won't survive a refresh.
  }
  return null;
}

async function call<T>(url: string, init: RequestInit, token?: string | null): Promise<T> {
  const res = await fetch(url, { ...init, cache: "no-store", headers: { "Content-Type": "application/json", ...(token ? { "x-player-token": token } : {}) } });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? "Something went wrong. Please try again.");
  return data as T;
}

interface Summary {
  key: string;
  name: string;
  tagline: string;
  minPlayers: number;
  today: string;
  playing: number;
  leaders: { name: string; score: number }[];
  history: { day: string; winners: { name: string; score: number }[]; top: { name: string; score: number }[]; players: number }[];
}

function useSummary() {
  const [games, setGames] = useState<Summary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let stop = false;
    const load = () =>
      call<{ games: Summary[] }>("/api/holidays/public", { method: "GET" })
        .then((d) => !stop && (setGames(d.games), setError(null)))
        .catch((e) => !stop && setError(e.message));
    void load();
    const t = window.setInterval(load, 10_000);
    return () => {
      stop = true;
      window.clearInterval(t);
    };
  }, []);
  return { games, error };
}

interface PubView {
  gameKey: string;
  day: string;
  you: { id: string; name: string; status: "active" | "queued" | "gone"; score: number; rank: number | null; removed: "idle" | "left" | null; missed: number } | null;
  here: number;
  leaders: { id: string; name: string; score: number }[];
  game: unknown;
  serverNow: number;
  version: number;
}

function usePublic(game: string) {
  const [token, setToken] = useState<string | null>(() => store(TOKEN_KEY(game)));
  const [view, setView] = useState<PubView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [skew, setSkew] = useState(0);
  const version = useRef<number | null>(null);

  const accept = useCallback((v: PubView) => {
    version.current = v.version;
    setSkew(v.serverNow - Date.now());
    setView(v);
  }, []);

  useEffect(() => {
    let stop = false;
    let timer: number | undefined;
    const poll = async () => {
      try {
        const d = await call<{ same?: boolean; serverNow: number; view?: PubView }>(`/api/holidays/public/${game}${version.current !== null ? `?v=${version.current}` : ""}`, { method: "GET" }, token);
        if (d.view) accept(d.view);
        else setSkew(d.serverNow - Date.now());
        setError(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Reconnecting…");
      }
      if (!stop) timer = window.setTimeout(poll, document.hidden ? 4000 : 1000);
    };
    void poll();
    const wake = () => !document.hidden && (window.clearTimeout(timer), void poll());
    document.addEventListener("visibilitychange", wake);
    return () => {
      stop = true;
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", wake);
    };
  }, [game, token, accept]);

  const join = async (name: string) => {
    try {
      const d = await call<{ token: string; view: PubView }>(`/api/holidays/public/${game}`, { method: "POST", body: JSON.stringify({ op: "join", name }) }, token);
      store(TOKEN_KEY(game), d.token);
      store(NAME_KEY, name);
      setToken(d.token);
      accept(d.view);
      return null;
    } catch (e) {
      return e instanceof Error ? e.message : "Something went wrong.";
    }
  };

  const send = async (op: "act" | "leave", action?: unknown) => {
    try {
      const d = await call<{ view: PubView }>(`/api/holidays/public/${game}`, { method: "POST", body: JSON.stringify({ op, action }) }, token);
      accept(d.view);
      return null;
    } catch (e) {
      return e instanceof Error ? e.message : "Something went wrong.";
    }
  };

  return { view, error, skew, join, send };
}

// ─── Hub ─────────────────────────────────────────────────────────────────────

export function StrangersHub({ onBack, onPlay, onWinners }: { onBack: () => void; onPlay: (game: string) => void; onWinners: () => void }) {
  const { games, error } = useSummary();
  return (
    <div className="h-full overflow-y-auto px-4 pb-8">
      <div className="pt-2">
        <BackLink onClick={onBack} />
      </div>
      <ScriptTitle size="clamp(40px, 11vw, 54px)">Play with strangers</ScriptTitle>
      <Squiggle i={2} />
      <Write i={2} as="p" className={`${readFont.className} mt-2 text-center text-[18px] text-[#F5EFE2]/80`}>
        One big game for the whole bar. Scores reset every day — the top score each day goes on the winners board.
      </Write>
      {error && <p className={`${readFont.className} mt-3 text-center text-[16px] text-[#F0A79F]`}>{error}</p>}
      <ul className="mt-5 space-y-3">
        {(games ?? []).map((g, n) => (
          <li key={g.key}>
            <HandBox i={3 + n} onClick={() => onPlay(g.key)} label={`Play ${g.name}`} className="px-4 py-3">
              <div className="flex items-baseline justify-between gap-2">
                <h2 className={`${handFont.className} text-[30px] font-bold`}>{g.name}</h2>
                <span className={`${handFont.className} text-[19px] font-bold text-[#F5EFE2]/70`}>{g.playing} playing now</span>
              </div>
              <p className={`${readFont.className} text-[17px] text-[#F5EFE2]/80 leading-snug`}>{g.tagline}</p>
              {g.leaders[0] && (
                <p className={`${handFont.className} mt-1 text-[18px] font-bold text-[#F5EFE2]/60`}>
                  <Star size={13} className="inline -mt-1 mr-1" />
                  Leading today: {g.leaders[0].name} ({g.leaders[0].score})
                </p>
              )}
            </HandBox>
          </li>
        ))}
        {!games && !error && <Write as="li" className={`${handFont.className} text-center text-[24px] font-bold`}>Checking who&rsquo;s playing…</Write>}
      </ul>
      <div className="mt-6">
        <HandButton i={6} onClick={onWinners}>
          See daily winners
        </HandButton>
      </div>
    </div>
  );
}

// ─── Daily winners ───────────────────────────────────────────────────────────

function prettyDay(day: string) {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

export function DailyWinners({ onBack, startOn }: { onBack: () => void; startOn?: string }) {
  const { games, error } = useSummary();
  const [tab, setTab] = useState(startOn ?? "word-grid");
  const g = games?.find((x) => x.key === tab) ?? games?.[0];
  return (
    <div className="h-full overflow-y-auto px-4 pb-8">
      <div className="pt-2">
        <BackLink onClick={onBack} />
      </div>
      {/* eslint-disable-next-line @next/next/no-img-element -- drawn wreath */}
      <img src="/popup/holidays/extras/wreath.webp" alt="" className="hh-pop mx-auto h-[90px] w-auto select-none" draggable={false} />
      <ScriptTitle star={false} size="clamp(40px, 11vw, 54px)">Daily winners</ScriptTitle>
      <div className="mt-3 flex justify-center gap-2" role="tablist">
        {(games ?? []).map((x) => (
          <button
            key={x.key}
            type="button"
            role="tab"
            aria-selected={x.key === g?.key}
            onClick={() => setTab(x.key)}
            className={`${handFont.className} relative min-h-[44px] px-3 text-[24px] font-bold ${x.key === g?.key ? "text-[#F5EFE2]" : "text-[#F5EFE2]/50"}`}
          >
            {x.name}
            {x.key === g?.key && (
              <svg aria-hidden viewBox="0 0 100 10" preserveAspectRatio="none" className="absolute left-2 right-2 bottom-1 h-2 w-[calc(100%-16px)]">
                <path d="M2 6 C 30 2, 60 9, 98 4" stroke={COLORS.star} strokeWidth="2.4" fill="none" strokeLinecap="round" pathLength={1} className="hh-draw" />
              </svg>
            )}
          </button>
        ))}
      </div>
      {error && <p className={`${readFont.className} mt-3 text-center text-[16px] text-[#F0A79F]`}>{error}</p>}
      {g && (
        <div key={g.key} className="mt-4 space-y-4">
          <HandBox i={1} className="px-4 py-3">
            <Label i={1}>Today so far</Label>
            {g.leaders.length ? (
              <ol className="mt-1">
                {g.leaders.slice(0, 5).map((l, i) => (
                  <li key={l.name} className={`${handFont.className} flex justify-between text-[24px] font-bold`}>
                    <span>
                      {i === 0 && <Star size={14} className="inline -mt-1 mr-1" />}
                      {l.name}
                    </span>
                    <span>{l.score}</span>
                  </li>
                ))}
              </ol>
            ) : (
              <p className={`${readFont.className} text-[17px] text-[#F5EFE2]/70`}>Nobody has scored yet today. It could be you!</p>
            )}
          </HandBox>
          <div>
            <Label i={2}>Past days</Label>
            {g.history.length === 0 && <p className={`${readFont.className} mt-1 text-[17px] text-[#F5EFE2]/70`}>The first winner will appear here after today.</p>}
            <ul className="mt-1 divide-y divide-[#F5EFE2]/10">
              {g.history.map((h, i) => (
                <Write key={h.day} as="li" i={3 + i * 0.3} className="py-2">
                  <div className="flex items-baseline justify-between">
                    <span className={`${handFont.className} text-[20px] font-bold text-[#F5EFE2]/70`}>{prettyDay(h.day)}</span>
                    <span className={`${readFont.className} text-[14px] text-[#F5EFE2]/50`}>{h.players} players</span>
                  </div>
                  <p className={`${handFont.className} text-[26px] font-bold leading-tight`}>
                    <Star size={14} className="inline -mt-1 mr-1" />
                    {h.winners.map((w) => w.name).join(" & ")} — {h.winners[0].score}
                  </p>
                  {h.top.length > h.winners.length && (
                    <p className={`${readFont.className} text-[15px] text-[#F5EFE2]/60`}>
                      {h.top.slice(h.winners.length, 4).map((t) => `${t.name} ${t.score}`).join(" · ")}
                    </p>
                  )}
                </Write>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── The live bar-wide game ──────────────────────────────────────────────────

const NAMES: Record<string, string> = { "word-grid": "Word Grid", "massive-decks": "Massive Decks" };

export function PublicRoom({ game, onLeave, onWinners, rules }: { game: string; onLeave: () => void; onWinners: () => void; rules: RulesSection[] }) {
  const { view, error, skew, join, send } = usePublic(game);
  const [name, setName] = useState(() => store(NAME_KEY) ?? "");
  const [problem, setProblem] = useState<string | null>(null);
  const [sheet, setSheet] = useState<"scores" | "rules" | null>(null);
  const joined = view?.you && view.you.status !== "gone";

  if (!view) {
    return (
      <div className="h-full flex items-center justify-center">
        <Write className={`${handFont.className} text-[28px] font-bold`}>{error ?? "Finding the game…"}</Write>
      </div>
    );
  }

  if (!joined) {
    const removed = view.you?.removed === "idle";
    return (
      <div className="h-full flex flex-col px-6 overflow-y-auto">
        <div className="pt-2 -mx-2">
          <BackLink onClick={onLeave} />
        </div>
        <form
          className="flex-1 flex flex-col items-center justify-center gap-3 pb-8"
          onSubmit={async (e) => {
            e.preventDefault();
            setProblem(await join(name.trim()));
          }}
        >
          <ScriptTitle>{NAMES[game]}</ScriptTitle>
          <Write i={2} as="p" className={`${readFont.className} text-center text-[18px] text-[#F5EFE2]/80 max-w-[320px]`}>
            {removed ? "You were taken out of the game for missing turns. Jump back in whenever you're ready — your score for today is saved." : `${view.here} ${view.here === 1 ? "person is" : "people are"} playing right now.`}
          </Write>
          <div className="w-full max-w-[340px] space-y-2">
            <Label i={3}>Your name for the scoreboard</Label>
            <HandBox i={4}>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={16}
                placeholder="Type a name"
                aria-label="Your name for the scoreboard"
                className={`${readFont.className} w-full bg-transparent px-3 py-3 text-[22px] text-[#F5EFE2] placeholder:text-[#F5EFE2]/40 outline-none`}
              />
            </HandBox>
            <p className={`${readFont.className} text-[14px] text-[#F5EFE2]/55`}>Keep it friendly — it shows on the winners board.</p>
            {problem && <p className={`${readFont.className} text-center text-[17px] text-[#F0A79F]`}>{problem}</p>}
            <HandButton i={5} primary type="submit" disabled={!name.trim()}>
              {removed ? "Rejoin" : "Join the game"}
            </HandButton>
            <HandButton i={6} small onClick={() => setSheet("rules")}>
              How to play
            </HandButton>
          </div>
        </form>
        {sheet === "rules" && <RulesSheet rules={rules} onClose={() => setSheet(null)} />}
      </div>
    );
  }

  const you = view.you!;
  const act = async (action: unknown) => send("act", action);
  return (
    <div className="h-full flex flex-col">
      <div className="shrink-0 flex items-center gap-2 px-3 pt-2 pb-1 border-b border-[#F5EFE2]/10">
        <p className={`${handFont.className} flex-1 min-w-0 text-[21px] font-bold leading-tight break-words`}>
          {you.name} · {you.score} today{you.rank ? ` · #${you.rank}` : ""}
        </p>
        <TopButton onClick={() => setSheet("scores")}>Today</TopButton>
        <TopButton onClick={() => setSheet("rules")}>Rules</TopButton>
        <TopButton
          onClick={async () => {
            await send("leave");
            onLeave();
          }}
        >
          Leave
        </TopButton>
      </div>
      {error && <p className={`${readFont.className} shrink-0 text-center text-[14px] text-[#F5EFE2]/60`}>{error}</p>}
      <div className="flex-1 min-h-0">
        {game === "word-grid" ? <PublicGrid v={view.game as GridView} skew={skew} act={act} /> : <PublicMassive v={view.game as MassiveView} skew={skew} act={act} missed={you.missed} />}
      </div>
      {sheet === "scores" && (
        <Sheet onClose={() => setSheet(null)}>
          <ScriptTitle star={false} size="44px">
            Today&rsquo;s leaders
          </ScriptTitle>
          <ol className="mt-3 max-w-[360px] mx-auto">
            {view.leaders.map((l, i) => (
              <li key={l.id} className={`${handFont.className} flex justify-between text-[25px] font-bold ${l.id === you.id ? "text-[#F5EFE2]" : "text-[#F5EFE2]/80"}`}>
                <span>
                  {i + 1}. {l.name}
                  {l.id === you.id && " (you)"}
                </span>
                <span>{l.score}</span>
              </li>
            ))}
            {view.leaders.length === 0 && <li className={`${readFont.className} text-center text-[17px]`}>No scores yet today.</li>}
          </ol>
          <div className="mt-4">
            <HandButton small onClick={() => (setSheet(null), onWinners())}>
              See daily winners
            </HandButton>
          </div>
        </Sheet>
      )}
      {sheet === "rules" && <RulesSheet rules={rules} onClose={() => setSheet(null)} />}
    </div>
  );
}

function TopButton({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} className={`${handFont.className} shrink-0 min-h-[44px] px-2 text-[20px] font-bold text-[#F5EFE2]/80`}>
      {children}
    </button>
  );
}

function Sheet({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end" role="dialog" aria-modal="true">
      <button type="button" aria-label="Close" onClick={onClose} className="absolute inset-0 bg-black/45 hh-screen" />
      <div className="relative hh-sheet hh-paper max-h-[82dvh] overflow-y-auto rounded-t-[18px] px-4 pt-4 pb-6 border-t border-[#F5EFE2]/20">
        {children}
        <div className="mt-4">
          <HandButton small onClick={onClose}>
            Close
          </HandButton>
        </div>
      </div>
    </div>
  );
}

function RulesSheet({ rules, onClose }: { rules: RulesSection[]; onClose: () => void }) {
  return (
    <Sheet onClose={onClose}>
      <div className="space-y-4">
        {rules.map((r, n) => (
          <section key={r.heading}>
            <Write i={n} as="h3" className={`${handFont.className} text-[25px] font-bold`}>
              {r.heading}
            </Write>
            <ul className="mt-1 space-y-1.5">
              {r.body.map((line, k) => (
                <li key={k} className={`${readFont.className} text-[18px] leading-snug pl-4 relative`}>
                  <span aria-hidden className="absolute left-0 text-[#D63A2F]">
                    ✶
                  </span>
                  {line}
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </Sheet>
  );
}

function Clock({ until, skew, size = 44, label }: { until: number; skew: number; size?: number; label?: string }) {
  const left = useCountdown(until || null, skew);
  if (left === null) return null;
  return (
    <p className={`${handFont.className} text-center font-bold leading-none tabular-nums`} style={{ fontSize: size, color: left <= 10 ? COLORS.star : undefined }}>
      {label && <span className="block text-[18px] text-[#F5EFE2]/60">{label}</span>}
      {left >= 60 ? `${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}` : left}
    </p>
  );
}

const Note = ({ children, tone }: { children: React.ReactNode; tone?: "error" }) =>
  children ? <p className={`${readFont.className} text-center text-[16px] px-4 ${tone ? "text-[#F0A79F]" : "text-[#F5EFE2]/75"}`}>{children}</p> : null;

// ─── Word Grid board (bar-wide) ──────────────────────────────────────────────

interface GridView {
  round: number;
  phase: "idle" | "live" | "results";
  board: string[];
  endsAt: number;
  nextAt: number;
  inRound: boolean;
  inThisRound: number;
  waiting: number;
  found: string[];
  rejected: string[];
  last: { round: number; results: { id: string; name: string; accepted: { word: string; points: number }[]; cancelled: string[]; total: number }[]; winners: string[] } | null;
}

function PublicGrid({ v, skew, act }: { v: GridView; skew: number; act: (a: unknown) => Promise<string | null> }) {
  const [error, setError] = useState<string | null>(null);
  useEffect(() => setError(null), [v.round, v.phase]);

  if (v.phase === "results" && v.last) {
    return (
      <div className="h-full overflow-y-auto pb-4">
        <Clock until={v.nextAt} skew={skew} label="Next round in" />
        <p className={`${handFont.className} text-center text-[26px] font-bold mt-2`}>
          {v.last.winners.length ? `Round ${v.last.round} goes to ${v.last.winners.join(" & ")}!` : `Round ${v.last.round}: no unique words`}
        </p>
        <ol className="px-4 mt-2 space-y-2">
          {v.last.results.map((r, n) => (
            <HandBox key={r.id} i={n * 0.5} className="px-3 py-2">
              <p className={`${handFont.className} text-[22px] font-bold`}>
                {r.name} · +{r.total}
              </p>
              <p className={`${readFont.className} text-[15px]`}>{r.accepted.map((a) => a.word).join(", ") || "—"}</p>
              {r.cancelled.length > 0 && <p className={`${readFont.className} text-[14px] text-[#F5EFE2]/50 line-through`}>{r.cancelled.join(", ")}</p>}
            </HandBox>
          ))}
        </ol>
      </div>
    );
  }

  if (!v.inRound) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-3 px-6 text-center">
        <h2 className={`${scriptFont.className} text-[50px] leading-none`}>Hang tight</h2>
        <p className={`${readFont.className} text-[19px]`}>A round is in progress with {v.inThisRound} {v.inThisRound === 1 ? "player" : "players"}. You&rsquo;re in the next one.</p>
        <Clock until={v.endsAt} skew={skew} label="This round ends in" />
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto flex flex-col pb-3">
      <Note>
        Round {v.round} · {v.inThisRound} playing{v.waiting ? ` · ${v.waiting} waiting for the next` : ""}
      </Note>
      <Clock until={v.endsAt} skew={skew} />
      <div className="py-2">
        <LetterGrid board={v.board} error={error} onWord={async (path) => setError(await act({ type: "word", path }))} />
      </div>
      <p className={`${readFont.className} px-4 pt-2 text-[16px] text-center`}>
        <span className={`${handFont.className} font-bold text-[19px]`}>Your words ({v.found.length}): </span>
        {v.found.join(", ") || "none yet"}
        {v.rejected.length > 0 && <span className="text-[#F0A79F]/80"> · not words: {v.rejected.join(", ")}</span>}
      </p>
    </div>
  );
}

// ─── Massive Decks board (bar-wide) ──────────────────────────────────────────

interface MassiveView {
  phase: "waiting" | "submit" | "judge" | "result";
  round: number;
  needed: number;
  ready: number;
  prompt: string | null;
  deadline: number;
  inRound: boolean;
  seats: number;
  judge: { id: string; name: string } | null;
  isJudge: boolean;
  hand: { id: number; text: string }[];
  yourAnswer: { text: string; auto: boolean } | null;
  locked: number;
  owed: number;
  answers: { id: number; text: string; by: string | null; won: boolean; auto: boolean }[];
  winner: string | null;
  autoJudged: boolean;
  voided: boolean;
}

function PublicMassive({ v, skew, act, missed }: { v: MassiveView; skew: number; act: (a: unknown) => Promise<string | null>; missed: number }) {
  const [sel, setSel] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => setSel(null), [v.round, v.phase]);

  if (v.phase === "waiting") {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-3 px-6 text-center">
        <h2 className={`${scriptFont.className} text-[50px] leading-none`}>Almost there</h2>
        <p className={`${handFont.className} text-[34px] font-bold leading-tight`}>
          Waiting for {v.needed} more {v.needed === 1 ? "player" : "players"} to begin
        </p>
        <p className={`${readFont.className} text-[18px] text-[#F5EFE2]/75`}>{v.ready} here now. The game starts by itself as soon as there are four.</p>
        <div className="flex gap-2 mt-2">
          {Array.from({ length: Math.max(4, v.ready) }, (_, i) => (
            <Star key={i} size={26} i={i} className={i < v.ready ? "" : "opacity-25"} />
          ))}
        </div>
      </div>
    );
  }

  const prompt = (
    <div className="px-4 pt-2">
      <HandBox className="px-4 py-3 text-center">
        <p className={`${handFont.className} text-[27px] font-bold leading-tight`}>{v.prompt}</p>
      </HandBox>
    </div>
  );

  if (!v.inRound) {
    return (
      <div className="h-full overflow-y-auto pb-4">
        {prompt}
        <div className="flex flex-col items-center gap-2 px-6 pt-6 text-center">
          <h2 className={`${scriptFont.className} text-[48px] leading-none`}>Next round&rsquo;s yours</h2>
          <p className={`${readFont.className} text-[18px]`}>A round is in progress. You&rsquo;ll be dealt in when it ends.</p>
          <Clock until={v.deadline} skew={skew} size={36} />
        </div>
      </div>
    );
  }

  const label = v.phase === "submit" ? "Pick an answer" : v.phase === "judge" ? (v.isJudge ? "Pick the winner" : `${v.judge?.name} is judging`) : "Next round in";
  return (
    <div className="h-full overflow-y-auto flex flex-col pb-3">
      {prompt}
      <Clock until={v.deadline} skew={skew} size={36} label={label} />
      {missed > 0 && v.phase === "submit" && (
        <Note tone="error">We played a card for you last time. Miss one more turn and you&rsquo;ll be taken out of the game.</Note>
      )}
      <div className="flex-1 px-4 py-2 space-y-2">
        {v.phase === "submit" &&
          (v.isJudge ? (
            <p className={`${handFont.className} text-center text-[26px] font-bold pt-4`}>
              You&rsquo;re judging! Answers in: {v.locked} of {v.owed}
            </p>
          ) : v.yourAnswer ? (
            <p className={`${handFont.className} text-center text-[26px] font-bold pt-4`}>
              You played “{v.yourAnswer.text}”. Answers in: {v.locked} of {v.owed}
            </p>
          ) : (
            v.hand.map((c, i) => (
              <HandBox key={c.id} i={i * 0.4} onClick={() => setSel(c.id)} className={`px-3 py-2 ${sel === c.id ? "bg-[#F5EFE2]/12" : ""}`}>
                <p className={`${readFont.className} text-[18px] leading-snug`}>{c.text}</p>
              </HandBox>
            ))
          ))}
        {(v.phase === "judge" || v.phase === "result") &&
          v.answers.map((a, i) => (
            <HandBox key={a.id} i={i * 0.4} onClick={v.phase === "judge" && v.isJudge ? () => setSel(a.id) : undefined} className={`px-3 py-2 ${sel === a.id ? "bg-[#F5EFE2]/12" : ""}`}>
              <p className={`${readFont.className} text-[18px] leading-snug`}>
                {a.won && <span style={{ color: COLORS.star }}>★ </span>}
                {a.text}
              </p>
              {a.by && (
                <p className={`${handFont.className} text-[16px] font-bold text-[#F5EFE2]/60`}>
                  {a.by}
                  {a.auto && " (played for them)"}
                </p>
              )}
            </HandBox>
          ))}
        {v.phase === "result" && (
          <p className={`${handFont.className} text-center text-[26px] font-bold`}>
            {v.voided ? "Not enough answers — next round!" : `${v.winner} wins the round!${v.autoJudged ? " (the judge ran out of time, so it was picked at random)" : ""}`}
          </p>
        )}
      </div>
      <Note tone="error">{error}</Note>
      {v.phase === "submit" && !v.isJudge && !v.yourAnswer && (
        <div className="px-4">
          <HandButton primary small disabled={sel === null} onClick={async () => sel !== null && setError(await act({ type: "submit", card: sel }))}>
            {sel === null ? "Pick a card" : "Lock it in"}
          </HandButton>
        </div>
      )}
      {v.phase === "judge" && v.isJudge && (
        <div className="px-4">
          <HandButton primary small disabled={sel === null} onClick={async () => sel !== null && setError(await act({ type: "pick", card: sel }))}>
            {sel === null ? "Pick a favourite" : "This one wins!"}
          </HandButton>
        </div>
      )}
    </div>
  );
}
