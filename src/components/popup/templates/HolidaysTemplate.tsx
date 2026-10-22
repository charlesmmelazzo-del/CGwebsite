"use client";

// ─── Home for the Holidays ───────────────────────────────────────────────────
//
// The winter pop-up. No sign-in, no host character — a simple handwritten
// page with two things on it:
//   1. Holiday cocktail recipes to download (PDF per cocktail, from the admin).
//   2. Group games everyone plays on their own phone. One person hosts: picks
//      a game, gets a 4-digit code, and starts once everyone has joined.
//
// The games themselves are pure rules in src/lib/holidays/games; the server
// referees every move, and phones stay in sync by polling the room.

import { useEffect, useState } from "react";
import type { PopupTemplateProps } from "@/lib/popup/types";
import type { RoomView } from "@/lib/holidays/types";
import GamePicker from "../holidays/GamePicker";
import Recipes from "../holidays/Recipes";
import Room from "../holidays/Room";
import { DailyWinners, PublicRoom, StrangersHub } from "../holidays/Strangers";
import { getPublicGame } from "@/lib/holidays/public";
import { hostRoom, joinRoom, savedRoom, saveRoom, type Saved } from "../holidays/useRoom";
import { BackLink, HandBox, HandButton, handFont, HolidayStyles, Label, readFont, ScriptTitle, Squiggle, Write } from "../holidays/ui";

type Screen = "home" | "recipes" | "play" | "pick" | "join" | "room" | "strangers" | "public" | "winners";

export default function HolidaysTemplate({ menu, cocktails, recordInteraction, isSandbox }: PopupTemplateProps) {
  const [screen, setScreen] = useState<Screen>("home");
  const [saved, setSaved] = useState<Saved | null>(null);
  const [initial, setInitial] = useState<RoomView | null>(null);
  const [busy, setBusy] = useState(false);
  const [publicGame, setPublicGame] = useState("word-grid");
  const [winnersFrom, setWinnersFrom] = useState<Screen>("strangers");
  const [error, setError] = useState<string | null>(null);

  // Back in a game after a refresh or a locked phone.
  useEffect(() => {
    const s = savedRoom();
    if (s) {
      setSaved(s);
      setScreen("room");
    }
  }, []);

  function go(next: Screen) {
    setError(null);
    setScreen(next);
  }

  function enterRoom(token: string, room: RoomView) {
    const s = { code: room.code, token };
    saveRoom(s);
    setSaved(s);
    setInitial(room);
    go("room");
  }

  function leaveRoom() {
    saveRoom(null);
    setSaved(null);
    setInitial(null);
    go("home");
  }

  async function host(gameKey: string) {
    setBusy(true);
    setError(null);
    try {
      const { token, room } = await hostRoom(gameKey, menu.id, isSandbox);
      void recordInteraction("holiday_host", { gameKey });
      enterRoom(token, room);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  async function join(code: string, name: string) {
    setBusy(true);
    setError(null);
    try {
      const { token, room } = await joinRoom(code, name);
      enterRoom(token, room);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={`relative h-[calc(100dvh-49px)] overflow-hidden hh-paper text-[#F5EFE2] ${readFont.className}`}>
      <HolidayStyles />
      <div key={screen} className="absolute inset-0 hh-screen max-w-[560px] mx-auto">
        {screen === "home" && <Home onRecipes={() => go("recipes")} onPlay={() => go("play")} />}
        {screen === "recipes" && (
          <Recipes cocktails={cocktails} onBack={() => go("home")} onDownload={(c) => void recordInteraction("recipe_download", { name: c.name }, c.id)} />
        )}
        {screen === "play" && <HostOrJoin onBack={() => go("home")} onHost={() => go("pick")} onJoin={() => go("join")} onStrangers={() => go("strangers")} />}
        {screen === "strangers" && (
          <StrangersHub
            onBack={() => go("play")}
            onPlay={(g) => (setPublicGame(g), go("public"))}
            onWinners={() => (setWinnersFrom("strangers"), go("winners"))}
          />
        )}
        {screen === "public" && (
          <PublicRoom
            game={publicGame}
            rules={getPublicGame(publicGame)?.rules ?? []}
            onLeave={() => go("strangers")}
            onWinners={() => (setWinnersFrom("public"), go("winners"))}
          />
        )}
        {screen === "winners" && <DailyWinners startOn={publicGame} onBack={() => go(winnersFrom)} />}
        {screen === "pick" && <GamePicker onBack={() => go("play")} onHost={(g) => host(g.key)} busy={busy} error={error} />}
        {screen === "join" && <JoinForm onBack={() => go("play")} onJoin={join} busy={busy} error={error} />}
        {screen === "room" && saved && <Room key={saved.code + saved.token} saved={saved} initial={initial} onLeave={leaveRoom} />}
      </div>
    </div>
  );
}

function Home({ onRecipes, onPlay }: { onRecipes: () => void; onPlay: () => void }) {
  return (
    <div className="h-full flex flex-col items-center justify-center px-6 gap-2">
      <Label i={0} className="text-center">
        Common Good presents
      </Label>
      <ScriptTitle i={1} size="clamp(54px, 17vw, 84px)">
        Home for
        <br />
        the Holidays
      </ScriptTitle>
      <Squiggle i={4} width={190} />
      <div className="w-full max-w-[340px] mt-8 space-y-3">
        <HandButton i={5} onClick={onRecipes}>
          Holiday cocktail recipes
        </HandButton>
        <HandButton i={6} primary onClick={onPlay}>
          Play a game
        </HandButton>
      </div>
    </div>
  );
}

function HostOrJoin({ onBack, onHost, onJoin, onStrangers }: { onBack: () => void; onHost: () => void; onJoin: () => void; onStrangers: () => void }) {
  const choices = [
    { label: "Host a game for your friends", note: "Pick a game and get a code for your table", run: onHost, primary: true },
    { label: "Join a friend's game", note: "Someone at your table is hosting and has a code", run: onJoin },
    { label: "Play with strangers", note: "Here on your own? Join the bar-wide game and chase today's high score", run: onStrangers },
  ];
  return (
    <div className="h-full flex flex-col px-6 overflow-y-auto">
      <div className="pt-2 -mx-2">
        <BackLink onClick={onBack} />
      </div>
      <div className="flex-1 flex flex-col items-center justify-center gap-2 pb-6">
        <ScriptTitle>Let&rsquo;s play</ScriptTitle>
        <Write i={2} as="p" className={`${readFont.className} text-[19px] text-center text-[#F5EFE2]/80 max-w-[300px]`}>
          Everyone plays on their own phone.
        </Write>
        <div className="w-full max-w-[340px] mt-5 space-y-4">
          {choices.map((c, n) => (
            <div key={c.label}>
              <HandButton i={3 + n * 2} primary={c.primary} onClick={c.run}>
                {c.label}
              </HandButton>
              <Write i={4 + n * 2} as="p" className={`${readFont.className} text-center text-[16px] text-[#F5EFE2]/65 mt-1`}>
                {c.note}
              </Write>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function JoinForm({ onBack, onJoin, busy, error }: { onBack: () => void; onJoin: (code: string, name: string) => void; busy: boolean; error: string | null }) {
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const ready = code.length === 4 && name.trim().length > 0;
  return (
    <div className="h-full flex flex-col px-6 overflow-y-auto">
      <div className="pt-2 -mx-2">
        <BackLink onClick={onBack} />
      </div>
      <form
        className="flex-1 flex flex-col items-center justify-center gap-2 pb-8"
        onSubmit={(e) => {
          e.preventDefault();
          if (ready && !busy) onJoin(code, name.trim());
        }}
      >
        <ScriptTitle>Join a game</ScriptTitle>
        <div className="w-full max-w-[340px] mt-4 space-y-4">
          <div>
            <Label i={2}>The host&rsquo;s code</Label>
            <HandBox i={3} className="mt-1">
              <input
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 4))}
                inputMode="numeric"
                pattern="[0-9]*"
                autoComplete="off"
                placeholder="0000"
                aria-label="Game code"
                className={`${handFont.className} w-full bg-transparent px-3 py-2 text-center text-[60px] font-bold tracking-[0.3em] pl-[0.3em] text-[#F5EFE2] placeholder:text-[#F5EFE2]/20 outline-none`}
              />
            </HandBox>
          </div>
          <div>
            <Label i={4}>Your name</Label>
            <HandBox i={5} className="mt-1">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={16}
                autoComplete="given-name"
                placeholder="Type your name"
                aria-label="Your name"
                className={`${readFont.className} w-full bg-transparent px-3 py-3 text-[22px] text-[#F5EFE2] placeholder:text-[#F5EFE2]/40 outline-none`}
              />
            </HandBox>
          </div>
          {error && <p className={`${readFont.className} text-center text-[17px] text-[#F0A79F]`}>{error}</p>}
          <HandButton i={6} primary type="submit" disabled={!ready || busy}>
            {busy ? "Joining…" : "Join"}
          </HandButton>
        </div>
      </form>
    </div>
  );
}
