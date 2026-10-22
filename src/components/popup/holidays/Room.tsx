"use client";

// ─── One game room: lobby → rules → the game → the end ───────────────────────

import { useEffect, useState } from "react";
import { getGame, playerRange } from "@/lib/holidays/games";
import { startProblem } from "@/lib/holidays/rooms";
import type { RoomView, ScoreLine } from "@/lib/holidays/types";
import { BOARDS } from "./games";
import { Rules } from "./GamePicker";
import { useRoom, type Saved } from "./useRoom";
import { at, BackLink, COLORS, HandBox, HandButton, handFont, Label, readFont, ScriptTitle, Squiggle, Star, Write } from "./ui";

export default function Room({ saved, initial, onLeave }: { saved: Saved; initial: RoomView | null; onLeave: () => void }) {
  const { room, error, gone, skew, send } = useRoom(saved, initial);
  // Rules are offered once per game; "Play again" doesn't re-show them.
  const [rulesDone, setRulesDone] = useState(false);

  if (gone) {
    return (
      <Centered>
        <ScriptTitle>Game over</ScriptTitle>
        <Write i={2} as="p" className={`${readFont.className} text-[19px] text-center`}>
          This game isn&rsquo;t running any more.
        </Write>
        <div className="w-full max-w-[320px] mt-4">
          <HandButton primary i={3} onClick={onLeave}>
            Back home
          </HandButton>
        </div>
      </Centered>
    );
  }
  if (!room) {
    return (
      <Centered>
        <Write className={`${handFont.className} text-[28px] font-bold`}>Finding your table…</Write>
      </Centered>
    );
  }

  const game = getGame(room.gameKey);
  if (!game || !room.you) {
    return (
      <Centered>
        <Write as="p" className={`${readFont.className} text-[19px] text-center`}>
          You&rsquo;re not in this game any more.
        </Write>
        <div className="w-full max-w-[320px] mt-4">
          <HandButton primary onClick={onLeave}>
            Back home
          </HandButton>
        </div>
      </Centered>
    );
  }

  if (room.status === "lobby") return <Lobby room={room} send={send} onLeave={onLeave} error={error} />;
  if (room.status === "ended") return <Ended room={room} onLeave={onLeave} />;
  if (!rulesDone) return <RulesIntro gameKey={room.gameKey} onDone={() => setRulesDone(true)} />;
  return <Playing room={room} send={send} skew={skew} onLeave={onLeave} error={error} />;
}

function Centered({ children }: { children: React.ReactNode }) {
  return <div className="h-full flex flex-col items-center justify-center gap-2 px-6">{children}</div>;
}

// ─── Lobby ───────────────────────────────────────────────────────────────────

type Send = (op: Record<string, unknown>) => Promise<string | null>;

function Lobby({ room, send, onLeave, error }: { room: RoomView; send: Send; onLeave: () => void; error: string | null }) {
  const game = getGame(room.gameKey)!;
  const me = room.players.find((p) => p.id === room.you!.id)!;
  const host = room.you!.host;
  const [name, setName] = useState(me.name);
  const [problem, setProblem] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const notReady = startProblem({ ...room, id: "", players: room.players.map((p) => ({ ...p, token: "", joinedAt: "" })), state: null });

  async function saveName() {
    const clean = name.trim();
    if (!clean || clean === me.name) return;
    setProblem(await send({ op: "rename", name: clean }));
  }

  async function start() {
    setConfirming(false);
    setProblem(await send({ op: "start" }));
  }

  async function leave() {
    await send({ op: "leave" });
    onLeave();
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex-1 min-h-0 overflow-y-auto px-4 pb-4">
        <div className="pt-2">
          <BackLink onClick={leave}>{host ? "Cancel game" : "Leave"}</BackLink>
        </div>
        <ScriptTitle size="clamp(38px, 11vw, 52px)">{game.name}</ScriptTitle>

        {/* The code, big enough to read across a table. */}
        <div className="mt-3 text-center">
          <Label i={1}>{host ? "Give your friends this code" : "You're in game"}</Label>
          <p className={`${handFont.className} hh-write hh-slow text-[86px] font-bold leading-none tracking-[0.18em] pl-[0.18em]`} style={at(2)} aria-label={`Game code ${room.code.split("").join(" ")}`}>
            {room.code}
          </p>
          {host && (
            <Write i={3} as="p" className={`${readFont.className} text-[16px] text-[#F5EFE2]/70`}>
              They tap <em>Play a game</em> → <em>Join a game</em> and type it in.
            </Write>
          )}
        </div>

        {/* Your name. The host types theirs here; guests gave theirs to join. */}
        <div className="mt-5">
          <Label i={3}>Your name</Label>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void saveName();
            }}
            className="mt-1 flex gap-2"
          >
            <HandBox i={4} className="flex-1">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                onBlur={saveName}
                maxLength={16}
                placeholder="Type your name"
                autoComplete="given-name"
                enterKeyHint="done"
                className={`${readFont.className} w-full bg-transparent px-3 py-3 text-[21px] text-[#F5EFE2] placeholder:text-[#F5EFE2]/40 outline-none`}
              />
            </HandBox>
            {name.trim() !== me.name && name.trim() && (
              <div className="w-[96px]">
                <HandButton small type="submit">
                  Save
                </HandButton>
              </div>
            )}
          </form>
        </div>

        {/* Teams, for games played in teams or partnerships. */}
        {game.teams && (
          <div className="mt-5">
            <Label i={5}>Pick your team</Label>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {Array.from({ length: game.teams.count }, (_, t) => {
                const label = game.teams!.names?.[t] ?? `Team ${t + 1}`;
                const members = room.players.filter((p) => p.team === t);
                const mine = me.team === t;
                return (
                  <HandBox key={t} i={6 + t} onClick={() => !mine && send({ op: "team", team: t })} label={`Join ${label}`} className="px-3 py-3 min-h-[120px]">
                    <p className={`${handFont.className} text-[23px] font-bold leading-tight`}>
                      {mine && <span style={{ color: COLORS.star }}>★ </span>}
                      {label}
                    </p>
                    <ul className={`${readFont.className} text-[17px] mt-1`}>
                      {members.map((p) => (
                        <li key={p.id}>{p.id === me.id ? "You" : p.name || "(naming…)"}</li>
                      ))}
                      {members.length === 0 && <li className="text-[#F5EFE2]/45">Nobody yet</li>}
                    </ul>
                    {!mine && <p className={`${handFont.className} text-[17px] font-bold text-[#F5EFE2]/55 mt-1`}>Tap to join</p>}
                  </HandBox>
                );
              })}
            </div>
          </div>
        )}

        {/* Who's here. */}
        <div className="mt-5">
          <Label i={7}>
            {room.players.length} joined · {playerRange(game)}
          </Label>
          <ul className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
            {room.players.map((p, n) => (
              <Write key={p.id} as="li" i={8 + n * 0.3} className={`${readFont.className} text-[19px]`}>
                {p.host && <Star size={14} className="inline -mt-1 mr-1" />}
                {p.id === me.id ? `${p.name || "You"} (you)` : p.name || "(naming…)"}
                {host && !p.host && (
                  <button type="button" onClick={() => send({ op: "kick", playerId: p.id })} aria-label={`Remove ${p.name}`} className="ml-1 text-[#F5EFE2]/45 px-1">
                    ×
                  </button>
                )}
              </Write>
            ))}
          </ul>
        </div>
      </div>

      <div className="shrink-0 px-4 pt-2 pb-4 border-t border-[#F5EFE2]/10">
        {(problem || error) && <p className={`${readFont.className} text-center text-[16px] text-[#F0A79F] mb-1`}>{problem ?? error}</p>}
        {host ? (
          confirming ? (
            <div className="space-y-2">
              <Write as="p" className={`${readFont.className} text-center text-[18px]`}>
                Is everyone here? Once the game starts, <strong>nobody else can join</strong>.
              </Write>
              <div className="grid grid-cols-2 gap-2">
                <HandButton small onClick={() => setConfirming(false)}>
                  Wait
                </HandButton>
                <HandButton small primary i={1} onClick={start}>
                  Start!
                </HandButton>
              </div>
            </div>
          ) : (
            <>
              <p className={`${readFont.className} text-center text-[15px] text-[#F5EFE2]/65 mb-2`}>
                {notReady ?? "Wait until everyone has joined — no one can join after you start."}
              </p>
              <HandButton primary onClick={() => setConfirming(true)} disabled={!!notReady}>
                Start the game
              </HandButton>
            </>
          )
        ) : (
          <Write as="p" className={`${handFont.className} text-center text-[24px] font-bold py-2`}>
            Waiting for the host to start…
          </Write>
        )}
      </div>
    </div>
  );
}

// ─── Rules, as the game begins ───────────────────────────────────────────────

function RulesIntro({ gameKey, onDone }: { gameKey: string; onDone: () => void }) {
  const game = getGame(gameKey)!;
  const [all, setAll] = useState(false);
  return (
    <div className="h-full flex flex-col hh-screen">
      <div className="flex-1 min-h-0 overflow-y-auto px-4 pb-4 pt-6">
        <Label i={0} className="text-center">
          Here we go
        </Label>
        <ScriptTitle i={1}>{game.name}</ScriptTitle>
        <Squiggle i={3} />
        {all ? (
          <div className="mt-4">
            <Rules game={game} startAt={2} />
          </div>
        ) : (
          <div className="mt-5 space-y-2">
            <Write i={3} as="p" className={`${readFont.className} text-[19px] leading-snug text-center`}>
              {game.tagline}
            </Write>
            <ul className="mt-3 space-y-1.5">
              {game.rules.map((s, n) => (
                <Write key={s.heading} as="li" i={4 + n} className={`${readFont.className} text-[18px] leading-snug pl-4 relative`}>
                  <span aria-hidden className="absolute left-0 text-[#D63A2F]">
                    ✶
                  </span>
                  {s.body[0]}
                </Write>
              ))}
            </ul>
          </div>
        )}
      </div>
      <div className="shrink-0 px-4 pt-2 pb-4 grid grid-cols-2 gap-2">
        {!all && (
          <HandButton small i={6} onClick={() => setAll(true)}>
            See all the rules
          </HandButton>
        )}
        <HandButton small primary i={7} onClick={onDone} className={all ? "col-span-2" : ""}>
          {all ? "Let's play" : "Skip — let's play"}
        </HandButton>
      </div>
    </div>
  );
}

// ─── The game ────────────────────────────────────────────────────────────────

function Playing({ room, send, skew, onLeave, error }: { room: RoomView; send: Send; skew: number; onLeave: () => void; error: string | null }) {
  const game = getGame(room.gameKey)!;
  const entry = BOARDS[room.gameKey];
  const [sheet, setSheet] = useState<"scores" | "rules" | "menu" | null>(null);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const host = room.you!.host;
  const over = room.gameStatus?.over ?? false;
  const yourTurn = room.gameStatus?.turn.includes(room.you!.id) ?? false;

  // A gentle buzz when it becomes your turn (phones that support it).
  useEffect(() => {
    if (yourTurn) navigator.vibrate?.(60);
  }, [yourTurn]);

  const Board = entry?.Board;
  return (
    <div className="h-full flex flex-col">
      {/* Top strip: whose turn, and the menu. */}
      <div className="shrink-0 flex items-center gap-2 px-3 pt-2 pb-1 border-b border-[#F5EFE2]/10">
        <p key={room.gameStatus?.message} className={`${handFont.className} hh-write flex-1 min-w-0 text-[21px] font-bold leading-tight break-words`} aria-live="polite">
          {yourTurn && <span style={{ color: COLORS.star }}>★ </span>}
          {room.gameStatus?.message}
        </p>
        {room.scoreboard && (
          <TopButton onClick={() => setSheet("scores")} label="Scores">
            Scores
          </TopButton>
        )}
        <TopButton onClick={() => setSheet("rules")} label="Rules">
          Rules
        </TopButton>
        <TopButton onClick={() => setSheet("menu")} label="Menu">
          ☰
        </TopButton>
      </div>

      {error && <p className={`${readFont.className} shrink-0 text-center text-[14px] text-[#F5EFE2]/60`}>{error}</p>}

      <div className="flex-1 min-h-0 relative">
        {Board ? <Board view={room.game} you={room.you!.id} players={room.players} send={(action) => send({ op: "act", action })} skew={skew} isHost={host} /> : null}

        {over && (
          <div className="absolute inset-0 bg-[#5E5D50]/95 flex flex-col items-center justify-center px-6 gap-3 hh-screen">
            <ScriptTitle>{room.gameStatus!.message}</ScriptTitle>
            {room.scoreboard && <Scoreboard lines={room.scoreboard} you={room.you!.id} startAt={2} low={room.lowScoreWins} />}
            <div className="w-full max-w-[320px] space-y-2 mt-2">
              {host ? (
                <>
                  <HandButton primary i={5} onClick={() => send({ op: "rematch" })}>
                    Play again
                  </HandButton>
                  <HandButton i={6} onClick={() => send({ op: "end" })}>
                    End the game
                  </HandButton>
                </>
              ) : (
                <Write i={5} as="p" className={`${handFont.className} text-center text-[22px] font-bold`}>
                  Waiting for the host…
                </Write>
              )}
            </div>
          </div>
        )}
      </div>

      {sheet && (
        <Sheet onClose={() => (setSheet(null), setConfirmEnd(false))}>
          {sheet === "scores" && room.scoreboard && (
            <>
              <ScriptTitle star={false} size="44px">
                Scoreboard
              </ScriptTitle>
              <div className="mt-3">
                <Scoreboard lines={room.scoreboard} you={room.you!.id} startAt={1} low={room.lowScoreWins} />
              </div>
            </>
          )}
          {sheet === "rules" && (
            <>
              <ScriptTitle star={false} size="44px">
                {game.name}
              </ScriptTitle>
              <div className="mt-3">
                <Rules game={game} startAt={1} />
              </div>
            </>
          )}
          {sheet === "menu" && (
            <div className="space-y-2">
              <Write as="p" className={`${handFont.className} text-center text-[22px] font-bold text-[#F5EFE2]/70`}>
                Game {room.code} · {room.players.length} playing
              </Write>
              {host ? (
                confirmEnd ? (
                  <>
                    <Write as="p" className={`${readFont.className} text-center text-[18px]`}>
                      End the game for everyone?
                    </Write>
                    <div className="grid grid-cols-2 gap-2">
                      <HandButton small onClick={() => setConfirmEnd(false)}>
                        Keep playing
                      </HandButton>
                      <HandButton small primary i={1} onClick={() => send({ op: "end" })}>
                        End it
                      </HandButton>
                    </div>
                  </>
                ) : (
                  <HandButton i={1} onClick={() => setConfirmEnd(true)}>
                    End the game for everyone
                  </HandButton>
                )
              ) : (
                <HandButton i={1} onClick={onLeave}>
                  Leave this game
                </HandButton>
              )}
            </div>
          )}
        </Sheet>
      )}
    </div>
  );
}

function TopButton({ onClick, label, children }: { onClick: () => void; label: string; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} aria-label={label} className={`${handFont.className} shrink-0 min-h-[44px] px-2 text-[20px] font-bold text-[#F5EFE2]/80 hover:text-[#F5EFE2]`}>
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
        <div className="mt-5">
          <HandButton small onClick={onClose}>
            Close
          </HandButton>
        </div>
      </div>
    </div>
  );
}

export function Scoreboard({ lines, you, startAt = 0, low = false }: { lines: ScoreLine[]; you: string; startAt?: number; low?: boolean }) {
  const sorted = lines.slice().sort((a, b) => (low ? a.score - b.score : b.score - a.score));
  const best = sorted[0]?.score;
  return (
    <ol className="w-full max-w-[360px] mx-auto space-y-1">
      {sorted.map((l, n) => (
        <Write key={l.label} as="li" i={startAt + n * 0.5} className={`${handFont.className} flex items-baseline gap-2 text-[26px] font-bold`}>
          <span className="w-6 text-[#F5EFE2]/50">{n + 1}</span>
          <span className="flex-1 min-w-0 break-words">
            {l.label}
            {l.playerIds.includes(you) && <span className="text-[#F5EFE2]/55 text-[20px]"> (you)</span>}
          </span>
          {l.score === best && (low || best > 0) && <Star size={16} />}
          <span className="tabular-nums">{l.score}</span>
        </Write>
      ))}
    </ol>
  );
}

// ─── The end ─────────────────────────────────────────────────────────────────

function Ended({ room, onLeave }: { room: RoomView; onLeave: () => void }) {
  return (
    <Centered>
      <ScriptTitle>Thanks for playing</ScriptTitle>
      <Write i={2} as="p" className={`${readFont.className} text-[19px] text-center text-[#F5EFE2]/80`}>
        {room.endedBy === "host" ? "The host ended the game." : room.gameStatus?.message}
      </Write>
      {room.scoreboard && (
        <div className="w-full mt-3">
          <Scoreboard lines={room.scoreboard} you={room.you?.id ?? ""} startAt={3} low={room.lowScoreWins} />
        </div>
      )}
      <div className="w-full max-w-[320px] mt-5">
        <HandButton primary i={6} onClick={onLeave}>
          Back home
        </HandButton>
      </div>
    </Centered>
  );
}
