"use client";

import { useMemo, useState } from "react";
import { GAMES, playerRange } from "@/lib/holidays/games";
import { STYLE_LABELS, type GameDef, type GameStyle } from "@/lib/holidays/types";
import { BOARDS } from "./games";
import { at, BackLink, HandBox, HandButton, handFont, Label, readFont, ScriptTitle, Squiggle, Write } from "./ui";

type Sort = "name" | "fewest" | "most";
const SIZES = [2, 3, 4, 5, 6, 8, 10] as const;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyGame = GameDef<any, any, any>;

/** The host's list of games: filter by style and group size, tap for details. */
export default function GamePicker({ onBack, onHost, busy, error }: { onBack: () => void; onHost: (g: AnyGame) => void; busy: boolean; error: string | null }) {
  const [style, setStyle] = useState<GameStyle | "all">("all");
  const [size, setSize] = useState<number | null>(null);
  const [sort, setSort] = useState<Sort>("name");
  const [open, setOpen] = useState<AnyGame | null>(null);

  const styles = useMemo(() => Array.from(new Set(GAMES.flatMap((g) => g.styles))), []);
  const shown = useMemo(() => {
    const list = GAMES.filter((g) => (style === "all" || g.styles.includes(style)) && (size === null || (g.minPlayers <= size && g.maxPlayers >= size)));
    return list.sort((a, b) =>
      sort === "fewest" ? a.minPlayers - b.minPlayers || a.maxPlayers - b.maxPlayers : sort === "most" ? b.maxPlayers - a.maxPlayers || b.minPlayers - a.minPlayers : a.name.localeCompare(b.name)
    );
  }, [style, size, sort]);

  if (open) return <GameDetail game={open} onClose={() => setOpen(null)} onHost={() => onHost(open)} busy={busy} error={error} />;

  return (
    <div className="h-full overflow-y-auto px-4 pb-8">
      <div className="pt-2">
        <BackLink onClick={onBack} />
      </div>
      <ScriptTitle size="clamp(40px, 11vw, 54px)">Pick a game</ScriptTitle>
      <Squiggle i={2} />

      {/* Filters. */}
      <div className="mt-4 space-y-3">
        <div>
          <Label i={2}>Style</Label>
          <Chips
            options={[{ key: "all", label: "All" }, ...styles.map((s) => ({ key: s, label: STYLE_LABELS[s] }))]}
            value={style}
            onChange={(k) => setStyle(k as GameStyle | "all")}
            i={3}
          />
        </div>
        <div>
          <Label i={3}>How many playing?</Label>
          <Chips
            options={[{ key: "any", label: "Any" }, ...SIZES.map((n) => ({ key: String(n), label: n === 10 ? "10+" : String(n) }))]}
            value={size === null ? "any" : String(size)}
            onChange={(k) => setSize(k === "any" ? null : Number(k))}
            i={4}
          />
        </div>
        <div>
          <Label i={4}>Sort by</Label>
          <Chips
            options={[
              { key: "name", label: "A–Z" },
              { key: "fewest", label: "Fewest players" },
              { key: "most", label: "Most players" },
            ]}
            value={sort}
            onChange={(k) => setSort(k as Sort)}
            i={5}
          />
        </div>
      </div>

      <ul className="mt-5 space-y-3">
        {shown.map((g, n) => (
          <li key={g.key}>
            <HandBox i={n + 5} onClick={() => setOpen(g)} label={`${g.name}, ${playerRange(g)}`} className="px-4 py-3">
              <div className="flex items-baseline justify-between gap-3">
                <h2 className={`${handFont.className} text-[30px] font-bold leading-tight`}>{g.name}</h2>
                <span className={`${handFont.className} shrink-0 text-[19px] font-bold text-[#F5EFE2]/70`}>{playerRange(g)}</span>
              </div>
              <p className={`${readFont.className} text-[17px] text-[#F5EFE2]/80 leading-snug`}>{g.tagline}</p>
              <p className={`${handFont.className} mt-1 text-[17px] font-bold text-[#F5EFE2]/55`}>
                {g.styles.map((s) => STYLE_LABELS[s]).join(" · ")} · {g.time}
                {g.teams && " · Teams"}
              </p>
            </HandBox>
          </li>
        ))}
        {shown.length === 0 && (
          <Write as="li" className={`${readFont.className} text-center text-[18px] text-[#F5EFE2]/70 pt-4`}>
            No games fit that — try another group size or style.
          </Write>
        )}
      </ul>
    </div>
  );
}

function Chips({ options, value, onChange, i }: { options: { key: string; label: string }[]; value: string; onChange: (k: string) => void; i: number }) {
  return (
    <div className="flex flex-wrap gap-x-1 gap-y-1 mt-1" role="radiogroup">
      {options.map((o, n) => {
        const on = o.key === value;
        return (
          <button
            key={o.key}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(o.key)}
            className={`${handFont.className} hh-write relative min-h-[40px] px-3 text-[21px] font-bold ${on ? "text-[#F5EFE2]" : "text-[#F5EFE2]/55"}`}
            style={at(i + n * 0.3)}
          >
            {o.label}
            {on && (
              // A quick pen circle around the chosen one.
              <svg aria-hidden viewBox="0 0 100 40" preserveAspectRatio="none" className="absolute inset-0 w-full h-full overflow-visible">
                <path d="M8 22 C 6 6, 90 2, 94 18 C 98 34, 14 40, 6 26 C 4 18, 30 6, 52 6" fill="none" stroke="#D63A2F" strokeWidth="2" strokeLinecap="round" pathLength={1} className="hh-draw" />
              </svg>
            )}
          </button>
        );
      })}
    </div>
  );
}

/** A picture of the game: the owner's art if supplied, otherwise a live mini table. */
export function GamePicture({ game }: { game: AnyGame }) {
  if (game.image) {
    // eslint-disable-next-line @next/next/no-img-element -- static art
    return <img src={game.image} alt={`${game.name} being played`} className="w-full max-w-[340px] mx-auto rounded-[10px]" />;
  }
  const entry = BOARDS[game.key];
  if (!entry) return null;
  const Board = entry.Board;
  const view = entry.demo();
  // Drawn at phone size, then shrunk to fit the sheet.
  return (
    <HandBox className="mx-auto w-[280px] h-[340px] overflow-hidden">
      <div aria-hidden className="pointer-events-none origin-top-left hh-paper [&_*]:[scrollbar-width:none] [&_*::-webkit-scrollbar]:hidden" style={{ width: 380, height: 462, transform: "scale(0.7368)" }}>
        <Board view={view} you="d0" players={[]} send={async () => null} skew={0} preview />
      </div>
    </HandBox>
  );
}

function GameDetail({ game, onClose, onHost, busy, error }: { game: AnyGame; onClose: () => void; onHost: () => void; busy: boolean; error: string | null }) {
  return (
    <div className="h-full flex flex-col hh-screen">
      <div className="flex-1 min-h-0 overflow-y-auto px-4 pb-4">
        <div className="pt-2">
          <BackLink onClick={onClose}>All games</BackLink>
        </div>
        <ScriptTitle size="clamp(40px, 11vw, 56px)">{game.name}</ScriptTitle>
        <Write i={1} className={`${handFont.className} text-center text-[21px] font-bold text-[#F5EFE2]/75`}>
          {playerRange(game)} · {game.time}
          {game.teams && ` · ${game.teams.count} teams`}
        </Write>
        <div className="mt-4">
          <GamePicture game={game} />
        </div>
        <Write i={2} as="p" className={`${readFont.className} mt-4 text-[19px] leading-snug`}>
          {game.description}
        </Write>

        <div className="mt-5 space-y-4">
          <Label i={3}>How to play</Label>
          <Rules game={game} startAt={4} />
        </div>

        <Write i={8} as="p" className={`${readFont.className} mt-6 text-[14px] text-[#F5EFE2]/55`}>
          {game.license.name}
          {game.license.note && ` — ${game.license.note}`}
          {game.license.url && (
            <>
              {" "}
              <a href={game.license.url} target="_blank" rel="noreferrer" className="underline">
                License
              </a>
            </>
          )}
        </Write>
      </div>

      <div className="shrink-0 px-4 pt-2 pb-4 grid grid-cols-2 gap-2 border-t border-[#F5EFE2]/10">
        {error && <p className={`${readFont.className} col-span-2 text-center text-[16px] text-[#F0A79F]`}>{error}</p>}
        <HandButton small onClick={onClose}>
          Back
        </HandButton>
        <HandButton small primary i={1} onClick={onHost} disabled={busy}>
          {busy ? "Setting up…" : "Play this game"}
        </HandButton>
      </div>
    </div>
  );
}

export function Rules({ game, startAt = 0 }: { game: AnyGame; startAt?: number }) {
  return (
    <div className="space-y-4">
      {game.rules.map((section, n) => (
        <section key={section.heading}>
          <Write i={startAt + n} as="h3" className={`${handFont.className} text-[25px] font-bold`}>
            {section.heading}
          </Write>
          <ul className="mt-1 space-y-1.5">
            {section.body.map((line, k) => (
              <Write key={k} as="li" i={startAt + n + k * 0.3} className={`${readFont.className} text-[18px] leading-snug pl-4 relative`}>
                <span aria-hidden className="absolute left-0 text-[#D63A2F]">
                  ✶
                </span>
                {line}
              </Write>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
