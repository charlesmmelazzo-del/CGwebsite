"use client";

// Boards for the word & party games: Forbidden Words, Word Relay, Fishbowl,
// Unique Clues, Massive Decks, Pass the Word.

import { useEffect, useState } from "react";
import type { Outcome } from "@/lib/holidays/games/teamTurns";
import { useCountdown } from "../useRoom";
import { COLORS, HandBox, HandButton, handFont, readFont, scriptFont, Write } from "../ui";
import { Big, Board, Buttons, Countdown, NextButton, Note, TeamScores, useAct } from "./kit";
import type { BoardProps } from "./types";

type Team = { name: string; score: number; members: { id: string; name: string }[] };

function WordCard({ children, sub }: { children: React.ReactNode; sub?: React.ReactNode }) {
  return (
    <HandBox className="px-5 py-4 w-full max-w-[340px] text-center">
      <p className={`${handFont.className} text-[clamp(38px,11vw,54px)] font-bold leading-[1.05]`}>{children}</p>
      {sub}
    </HandBox>
  );
}

function TextInput({ value, onChange, placeholder, label, onEnter, maxLength = 40 }: { value: string; onChange: (v: string) => void; placeholder: string; label: string; onEnter?: () => void; maxLength?: number }) {
  return (
    <HandBox className="w-full">
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && onEnter?.()}
        placeholder={placeholder}
        aria-label={label}
        maxLength={maxLength}
        autoCapitalize="none"
        autoCorrect="off"
        enterKeyHint="send"
        className={`${readFont.className} w-full bg-transparent px-3 py-3 text-[21px] text-[#F5EFE2] placeholder:text-[#F5EFE2]/40 outline-none`}
      />
    </HandBox>
  );
}

// ─── Forbidden Words & Word Relay (shared timed-turn board) ──────────────────

interface TurnView {
  teams: Team[];
  team: number;
  giver: { id: string; name: string };
  referee: { id: string; name: string } | null;
  yourTeam: number | null;
  phase: "ready" | "live" | "done";
  endsAt: number | null;
  card: { word: string; banned?: string[] } | null;
  skipsLeft: number | null;
  resolved: number;
  turn: number;
  target: number;
  tiebreak: boolean;
  lastTurn: { team: string; giver: string; log: { card: { word: string }; outcome: Outcome }[]; corrections: number } | null;
  points: Record<Outcome, number>;
}

const OUTCOME_LABEL: Record<Outcome, string> = { correct: "Correct", skip: "Skipped", foul: "Foul", expired: "Time ran out" };

export function TurnBoard({ view: v, you, send, skew, preview, isHost }: BoardProps<TurnView>) {
  const { error, act } = useAct(send, preview);
  const giving = v.giver.id === you;
  const refereeing = v.referee?.id === you;
  const live = v.phase === "live";

  return (
    <Board>
      <TeamScores teams={v.teams} active={v.team} />
      <Note>
        Turn {v.turn} of {v.target} for {v.teams[v.team].name}
        {v.tiebreak && " · tiebreaker"}
      </Note>
      <div className="flex-1 flex flex-col items-center justify-center gap-3 px-4 py-2 text-center">
        {!live && (
          <>
            {v.lastTurn && (
              <div className="w-full max-w-[360px]">
                <p className={`${handFont.className} text-[20px] font-bold`}>{v.lastTurn.giver}&rsquo;s turn for {v.lastTurn.team}</p>
                <ul className={`${readFont.className} text-[16px] mt-1 space-y-0.5`}>
                  {v.lastTurn.log.map((e, i) => (
                    <li key={i} className="flex items-center justify-between gap-2">
                      <span className={e.outcome === "correct" ? "" : "text-[#F5EFE2]/60"}>{e.card.word}</span>
                      {isHost ? (
                        <select
                          value={e.outcome}
                          onChange={(ev) => act({ type: "review", index: i, outcome: ev.target.value })}
                          className={`${readFont.className} bg-transparent text-[15px] border border-[#F5EFE2]/30 rounded px-1`}
                          aria-label={`Correct the result for ${e.card.word}`}
                        >
                          {(Object.keys(v.points) as Outcome[]).map((o) => (
                            <option key={o} value={o} className="text-black">
                              {OUTCOME_LABEL[o]} ({v.points[o] > 0 ? "+" : ""}{v.points[o]})
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span className="text-[#F5EFE2]/70">{OUTCOME_LABEL[e.outcome]}</span>
                      )}
                    </li>
                  ))}
                </ul>
                {v.lastTurn.corrections > 0 && <Note>The host corrected {v.lastTurn.corrections} card{v.lastTurn.corrections > 1 ? "s" : ""}.</Note>}
                {isHost && <Note>Host: fix any disputed card before the next turn starts.</Note>}
              </div>
            )}
            {giving ? (
              <>
                <Write as="h2" className={`${scriptFont.className} text-[56px] leading-none`}>You&rsquo;re up!</Write>
                <Note>Give clues to {v.teams[v.team].name}.{v.referee && ` ${v.referee.name} is the referee.`}</Note>
              </>
            ) : (
              <Big className="text-[32px]">
                {v.giver.name} is up for {v.teams[v.team].name}
                {refereeing && <span className="block text-[22px] text-[#F5EFE2]/80">You&rsquo;re the referee this turn</span>}
              </Big>
            )}
          </>
        )}
        {live && (
          <>
            <Countdown endsAt={v.endsAt} skew={skew} />
            {v.card ? (
              <WordCard
                sub={
                  v.card.banned && (
                    <ul className={`${handFont.className} mt-2 text-[24px] font-bold leading-tight`} style={{ color: "#F0A79F" }}>
                      {v.card.banned.map((b) => (
                        <li key={b}>✗ {b}</li>
                      ))}
                    </ul>
                  )
                }
              >
                {v.card.word}
              </WordCard>
            ) : (
              <>
                <h2 className={`${scriptFont.className} text-[58px] leading-none`}>{v.yourTeam === v.team ? "Guess!" : "Listen in"}</h2>
                <Note>{v.yourTeam === v.team ? `Shout out answers for ${v.giver.name}.` : `${v.giver.name} is giving clues.`}</Note>
              </>
            )}
            {refereeing && <Note>Referee: tap Foul if they say a forbidden word.</Note>}
            <Big>{v.resolved} card{v.resolved === 1 ? "" : "s"} this turn</Big>
          </>
        )}
      </div>
      <Note tone="error">{error}</Note>
      {giving && v.phase === "ready" && <NextButton onClick={() => act({ type: "start" })}>Start my turn</NextButton>}
      {giving && live && (
        <Buttons>
          <HandButton disabled={v.skipsLeft === 0} onClick={() => act({ type: "skip" })}>
            Skip{v.skipsLeft !== null ? ` (${v.skipsLeft})` : v.points.skip < 0 ? " (−1)" : ""}
          </HandButton>
          <HandButton primary i={1} onClick={() => act({ type: "correct" })}>Correct!</HandButton>
        </Buttons>
      )}
      {refereeing && live && <NextButton onClick={() => act({ type: "foul" })}>Foul!</NextButton>}
    </Board>
  );
}

// ─── Fishbowl ────────────────────────────────────────────────────────────────

interface FishView {
  teams: Team[];
  phase: "submit" | "ready" | "live" | "done";
  submitted: number;
  players: number;
  youSubmitted: boolean;
  perPlayer: number;
  stage: number;
  stages: { name: string; rule: string }[];
  stageBanner: boolean;
  left: number;
  total: number;
  team: number;
  giver: { id: string; name: string };
  yourTeam: number | null;
  endsAt: number | null;
  card: string | null;
  skipped: boolean;
  gotThisTurn: number;
  last: { team: string; giver: string; got: number } | null;
}

export function FishbowlBoard({ view: v, you, send, skew, preview }: BoardProps<FishView>) {
  const { error, act } = useAct(send, preview);
  const [drafts, setDrafts] = useState(["", "", ""]);
  const giving = v.giver.id === you;
  const stage = v.stages[v.stage];

  if (v.phase === "submit") {
    return (
      <Board>
        <div className="flex-1 flex flex-col justify-center gap-3 px-4 py-3">
          <Write as="h2" className={`${scriptFont.className} text-center text-[50px] leading-none`}>Fill the bowl</Write>
          {v.youSubmitted ? (
            <Big>Thanks! Waiting for everyone — {v.submitted} of {v.players} done.</Big>
          ) : (
            <>
              <Note>Write {v.perPlayer} things — people, places, objects, anything family-friendly. Nobody else will see your list.</Note>
              {drafts.map((d, i) => (
                <TextInput key={i} value={d} onChange={(t) => setDrafts((cur) => cur.map((x, k) => (k === i ? t : x)))} placeholder={`Prompt ${i + 1}`} label={`Prompt ${i + 1}`} maxLength={60} />
              ))}
              <Note tone="error">{error}</Note>
              <HandButton primary disabled={drafts.some((d) => !d.trim())} onClick={() => act({ type: "submit", prompts: drafts })}>
                Drop them in the bowl
              </HandButton>
              <Note>{v.submitted} of {v.players} players are done</Note>
            </>
          )}
        </div>
      </Board>
    );
  }

  return (
    <Board>
      <TeamScores teams={v.teams} active={v.team} />
      <div className="text-center mt-1">
        <p className={`${handFont.className} text-[24px] font-bold`}>Stage {v.stage + 1}: {stage.name}</p>
        <Note>{stage.rule}</Note>
        <Note>{v.left} of {v.total} prompts left in this stage</Note>
      </div>
      <div className="flex-1 flex flex-col items-center justify-center gap-3 px-4 py-2 text-center">
        {v.phase === "ready" && (
          <>
            {v.last && <Note>{v.last.giver} got {v.last.got} for {v.last.team}.</Note>}
            {v.stageBanner && v.stage > 0 && <Big className="text-[30px]">New stage — same prompts!</Big>}
            {giving ? <Write as="h2" className={`${scriptFont.className} text-[56px] leading-none`}>You&rsquo;re up!</Write> : <Big className="text-[30px]">{v.giver.name} is up for {v.teams[v.team].name}</Big>}
          </>
        )}
        {v.phase === "live" && (
          <>
            <Countdown endsAt={v.endsAt} skew={skew} />
            {v.card ? <WordCard>{v.card}</WordCard> : <h2 className={`${scriptFont.className} text-[58px] leading-none`}>{v.yourTeam === v.team ? "Guess!" : "Watch"}</h2>}
            <Big>{v.gotThisTurn} this turn</Big>
          </>
        )}
      </div>
      <Note tone="error">{error}</Note>
      {giving && v.phase === "ready" && <NextButton onClick={() => act({ type: "start" })}>Start my turn</NextButton>}
      {giving && v.phase === "live" && (
        <div className="px-4 pb-2 grid grid-cols-3 gap-2">
          <HandButton small onClick={() => act({ type: "slip" })}>Oops</HandButton>
          <HandButton small i={1} disabled={v.skipped} onClick={() => act({ type: "skip" })}>Skip</HandButton>
          <HandButton small primary i={2} onClick={() => act({ type: "correct" })}>Correct!</HandButton>
        </div>
      )}
    </Board>
  );
}

// ─── Unique Clues ────────────────────────────────────────────────────────────

interface UniqueView {
  round: number;
  rounds: number;
  phase: "entry" | "review" | "guess" | "result" | "done";
  deadline: number;
  guesser: { id: string; name: string };
  moderator: { id: string; name: string };
  isGuesser: boolean;
  word: string | null;
  yourClue: string | null;
  locked: number;
  givers: number;
  clues: string[] | { id: string; name: string; word: string; dupe: boolean; struck: boolean }[];
  surviving: string[] | null;
  guess: string | null;
  correct: boolean | null;
  corrected: boolean;
  points: number;
  history: { word: string; correct: boolean }[];
}

export function UniqueCluesBoard({ view: v, you, send, skew, preview, isHost }: BoardProps<UniqueView>) {
  const { error, act } = useAct(send, preview);
  const [text, setText] = useState("");
  useEffect(() => setText(""), [v.round, v.phase]);
  const moderating = v.moderator.id === you;
  const detailed = (v.clues as unknown[]).length > 0 && typeof (v.clues as unknown[])[0] === "object";

  return (
    <Board>
      <Note>Word {v.round + 1} of {v.rounds} · team score {v.points}</Note>
      <div className="flex-1 flex flex-col items-center justify-center gap-3 px-4 py-2 text-center">
        {v.phase !== "result" && v.phase !== "done" && <Countdown endsAt={v.deadline} skew={skew} size={44} />}
        {v.word && v.phase !== "result" && <WordCard sub={<Note>Secret word — don&rsquo;t say it out loud!</Note>}>{v.word}</WordCard>}

        {v.phase === "entry" &&
          (v.isGuesser ? (
            <Big className="text-[30px]">You&rsquo;re guessing! Everyone&rsquo;s writing you a clue… ({v.locked} of {v.givers})</Big>
          ) : v.yourClue ? (
            <Big>Your clue: “{v.yourClue}” — locked in. ({v.locked} of {v.givers})</Big>
          ) : (
            <div className="w-full max-w-[340px] space-y-2">
              <Note>One word to help {v.guesser.name}. Matching clues cancel out!</Note>
              <TextInput value={text} onChange={setText} placeholder="Your one-word clue" label="Your clue" maxLength={30} onEnter={() => text.trim() && act({ type: "clue", word: text })} />
              <HandButton primary small disabled={!text.trim()} onClick={() => act({ type: "clue", word: text })}>Lock it in</HandButton>
            </div>
          ))}

        {v.phase === "review" &&
          (v.isGuesser ? (
            <Big className="text-[30px]">Checking the clues…</Big>
          ) : (
            <div className="w-full max-w-[340px]">
              <Note>{moderating ? "You're the moderator: strike any clue that breaks the rules." : `${v.moderator.name} is checking for rule breaks.`}</Note>
              <ul className="mt-2 space-y-1">
                {detailed &&
                  (v.clues as { id: string; name: string; word: string; dupe: boolean; struck: boolean }[]).map((c) => (
                    <li key={c.id} className="flex items-center justify-between gap-2">
                      <span className={`${handFont.className} text-[26px] font-bold ${c.dupe || c.struck || !c.word ? "line-through text-[#F5EFE2]/40" : ""}`}>{c.word || "(no clue)"}</span>
                      <span className={`${readFont.className} text-[14px] text-[#F5EFE2]/60`}>
                        {c.name}
                        {c.dupe && " · matched"}
                        {moderating && c.word && !c.dupe && (
                          <button type="button" onClick={() => act({ type: "strike", playerId: c.id })} className="ml-2 underline">
                            {c.struck ? "restore" : "strike"}
                          </button>
                        )}
                      </span>
                    </li>
                  ))}
              </ul>
              {moderating && (
                <div className="mt-3">
                  <HandButton primary small onClick={() => act({ type: "reviewDone" })}>Show the guesser</HandButton>
                </div>
              )}
            </div>
          ))}

        {v.phase === "guess" && (
          <>
            <ul className="flex flex-wrap justify-center gap-x-4 gap-y-1">
              {(v.surviving ?? []).map((c) => (
                <li key={c} className={`${handFont.className} text-[34px] font-bold`}>{c}</li>
              ))}
              {(v.surviving ?? []).length === 0 && <li className={`${readFont.className} text-[18px]`}>Every clue cancelled out!</li>}
            </ul>
            {v.isGuesser ? (
              <div className="w-full max-w-[340px] space-y-2">
                <TextInput value={text} onChange={setText} placeholder="Your guess" label="Your guess" onEnter={() => text.trim() && act({ type: "guess", word: text })} />
                <Buttons>
                  <HandButton small onClick={() => act({ type: "pass" })}>Pass</HandButton>
                  <HandButton small primary i={1} disabled={!text.trim()} onClick={() => act({ type: "guess", word: text })}>Guess</HandButton>
                </Buttons>
              </div>
            ) : (
              <Big>{v.guesser.name} is thinking…</Big>
            )}
          </>
        )}

        {(v.phase === "result" || v.phase === "done") && v.word && (
          <>
            <WordCard>{v.word}</WordCard>
            <Big className="text-[30px]" >
              {v.guess ? `“${v.guess}” — ` : "Passed — "}
              <span style={{ color: v.correct ? undefined : COLORS.star }}>{v.correct ? "correct!" : "not this time"}</span>
              {v.corrected && <span className="block text-[18px] text-[#F5EFE2]/60">(corrected by the host)</span>}
            </Big>
            {isHost && v.phase === "result" && (
              <button type="button" onClick={() => act({ type: "correction", correct: !v.correct })} className={`${readFont.className} underline text-[15px] text-[#F5EFE2]/70`}>
                Host: count this as {v.correct ? "wrong" : "correct"}
              </button>
            )}
          </>
        )}
        {v.phase === "done" && (
          <ul className={`${readFont.className} text-[16px]`}>
            {v.history.map((h, i) => (
              <li key={i}>{h.correct ? "★" : "·"} {h.word}</li>
            ))}
          </ul>
        )}
      </div>
      <Note tone="error">{error}</Note>
      {v.phase === "result" && <NextButton onClick={() => act({ type: "next" })}>{v.round + 1 >= v.rounds ? "See the final score" : "Next word"}</NextButton>}
    </Board>
  );
}

// ─── Massive Decks ───────────────────────────────────────────────────────────

interface MassiveView {
  prompt: string;
  phase: "submit" | "judge" | "result" | "over";
  deadline: number;
  judge: { id: string; name: string };
  isJudge: boolean;
  hand: { id: number; text: string }[];
  yourAnswer: string | null;
  locked: number;
  players: number;
  answers: { id: number; text: string; by: string | null; won: boolean }[];
  winner: string | null;
  voided: boolean;
}

function AnswerCard({ text, by, won, onClick, selected, i = 0 }: { text: string; by?: string | null; won?: boolean; onClick?: () => void; selected?: boolean; i?: number }) {
  return (
    <HandBox i={i} onClick={onClick} className={`px-3 py-2 text-left ${selected ? "bg-[#F5EFE2]/12" : ""}`}>
      <p className={`${readFont.className} text-[18px] leading-snug`}>
        {won && <span style={{ color: COLORS.star }}>★ </span>}
        {text}
      </p>
      {by && <p className={`${handFont.className} text-[16px] font-bold text-[#F5EFE2]/60`}>{by}</p>}
    </HandBox>
  );
}

export function MassiveDecksBoard({ view: v, send, skew, preview }: BoardProps<MassiveView>) {
  const { error, act } = useAct(send, preview);
  const [sel, setSel] = useState<number | null>(null);
  useEffect(() => setSel(null), [v.phase, v.prompt]);
  const left = useCountdown(v.phase === "submit" || v.phase === "judge" ? v.deadline : null, skew);

  return (
    <Board>
      <div className="px-4 pt-2">
        <HandBox className="px-4 py-3 text-center">
          <p className={`${handFont.className} text-[28px] font-bold leading-tight`}>{v.prompt}</p>
        </HandBox>
        <Note>
          {v.isJudge ? "You're the judge" : `${v.judge.name} is judging`}
          {left !== null && ` · ${left}s`}
        </Note>
      </div>
      <div className="flex-1 px-4 py-2 space-y-2">
        {v.phase === "submit" &&
          (v.isJudge ? (
            <Big className="pt-6">Answers coming in: {v.locked} of {v.players}</Big>
          ) : v.yourAnswer ? (
            <Big className="pt-6">You played “{v.yourAnswer}”. Waiting for the others… ({v.locked} of {v.players})</Big>
          ) : (
            <>
              <Note>Pick your funniest answer:</Note>
              {v.hand.map((c, i) => (
                <AnswerCard key={c.id} i={i * 0.4} text={c.text} selected={sel === c.id} onClick={() => setSel(c.id)} />
              ))}
            </>
          ))}
        {(v.phase === "judge" || v.phase === "result" || v.phase === "over") && (
          <>
            {v.phase === "judge" && <Note>{v.isJudge ? "Tap your favourite:" : "The judge is choosing…"}</Note>}
            {v.answers.map((a, i) => (
              <AnswerCard key={a.id} i={i * 0.4} text={a.text} by={a.by} won={a.won} selected={sel === a.id} onClick={v.phase === "judge" && v.isJudge ? () => setSel(a.id) : undefined} />
            ))}
          </>
        )}
        {v.phase === "result" && <Big>{v.voided ? "Not enough answers — round skipped." : v.winner ? `${v.winner} wins the round!` : "The judge ran out of time."}</Big>}
      </div>
      <Note tone="error">{error}</Note>
      {v.phase === "submit" && !v.isJudge && !v.yourAnswer && <NextButton onClick={() => sel !== null && act({ type: "submit", card: sel })}>{sel === null ? "Pick a card" : "Lock it in"}</NextButton>}
      {v.phase === "judge" && v.isJudge && <NextButton onClick={() => sel !== null && act({ type: "pick", card: sel })}>{sel === null ? "Pick a favourite" : "This one wins!"}</NextButton>}
      {v.phase === "result" && <NextButton onClick={() => act({ type: "next" })}>Next round</NextButton>}
    </Board>
  );
}

// ─── Pass the Word ───────────────────────────────────────────────────────────

interface PassView {
  teams: Team[];
  phase: "ready" | "live" | "roundOver" | "done";
  team: number;
  giver: { id: string; name: string };
  referee: { id: string; name: string };
  yourTeam: number | null;
  card: string | null;
  isReferee: boolean;
  skipUsed: boolean;
  lockoutUntil: number;
  passes: number;
  lastRound: { loser: string; winner: string } | null;
  target: number;
}

export function PassTheWordBoard({ view: v, you, send, skew, preview }: BoardProps<PassView>) {
  const { error, act } = useAct(send, preview);
  const giving = v.giver.id === you;
  const locked = useCountdown(v.lockoutUntil > 0 ? v.lockoutUntil : null, skew);

  return (
    <Board>
      <TeamScores teams={v.teams} active={v.phase === "live" ? v.team : undefined} />
      <Note>First to {v.target} · the team holding it at the buzzer loses the round</Note>
      <div className="flex-1 flex flex-col items-center justify-center gap-3 px-4 py-2 text-center">
        {v.phase === "ready" && (giving ? <Write as="h2" className={`${scriptFont.className} text-[54px] leading-none`}>You start!</Write> : <Big className="text-[30px]">{v.giver.name} starts for {v.teams[v.team].name}</Big>)}
        {v.phase === "roundOver" && v.lastRound && (
          <>
            <h2 className={`${scriptFont.className} text-[64px] leading-none`} style={{ color: COLORS.star }}>Buzz!</h2>
            <Big>{v.lastRound.loser} was holding it — {v.lastRound.winner} +1</Big>
          </>
        )}
        {v.phase === "live" && (
          <>
            {/* A steady "it's running" pulse — the real time left is a secret. */}
            <p className={`${handFont.className} text-[24px] font-bold animate-pulse`}>⏳ the clock is ticking…</p>
            <Big className="text-[30px]">{v.teams[v.team].name} has it</Big>
            {v.card ? (
              <WordCard sub={v.isReferee ? <Note>You&rsquo;re the referee</Note> : null}>{v.card}</WordCard>
            ) : (
              <h2 className={`${scriptFont.className} text-[56px] leading-none`}>{v.yourTeam === v.team ? "Guess fast!" : "Get ready…"}</h2>
            )}
            {giving && locked !== null && locked > 0 && <Big className="text-[#D63A2F]">Locked out: {locked}s</Big>}
            <Note>Passed {v.passes} time{v.passes === 1 ? "" : "s"} this round</Note>
          </>
        )}
      </div>
      <Note tone="error">{error}</Note>
      {giving && v.phase === "ready" && <NextButton onClick={() => act({ type: "start" })}>Start the clock</NextButton>}
      {giving && v.phase === "live" && (
        <Buttons>
          <HandButton disabled={v.skipUsed} onClick={() => act({ type: "skip" })}>Skip</HandButton>
          <HandButton primary i={1} disabled={locked !== null && locked > 0} onClick={() => act({ type: "correct" })}>Got it — pass!</HandButton>
        </Buttons>
      )}
      {v.isReferee && v.phase === "live" && <NextButton onClick={() => act({ type: "foul" })}>Foul!</NextButton>}
      {v.phase === "roundOver" && <NextButton onClick={() => act({ type: "next" })}>Next round</NextButton>}
    </Board>
  );
}
