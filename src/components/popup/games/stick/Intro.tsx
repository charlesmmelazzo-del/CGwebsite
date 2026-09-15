"use client";

// ─── Behind the Stick — title and how-to ─────────────────────────────────────
//
// The title is the logo and two buttons, nothing else. Picking a mode leads
// into a short run of slides, narrated by the bartender, so a guest knows what
// each thumb is for before anything starts moving. Plain DOM rather than
// canvas: it has to read well whichever way the phone is held, since the
// sideways prompt only comes up when the shift actually starts.

import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import CabButton from "../../cabinet/CabButton";
import { C } from "../../cabinet/theme";
import { ART } from "./art";
import type { Mode } from "./core";

const LOGO = "/popup/art/stick/logo-title.png";
const PIXELATED: CSSProperties = { imageRendering: "pixelated" };
const BACKDROP: CSSProperties = {
  background: `radial-gradient(circle at 50% 25%, ${C.plum} 0%, ${C.grapeDeep} 72%)`,
};

// ─── Title ───────────────────────────────────────────────────────────────────

export function TitleScreen({ onPick }: { onPick: (mode: Mode) => void }) {
  return (
    <div className="absolute inset-0 overflow-y-auto overscroll-contain" style={BACKDROP}>
      <div className="min-h-full flex flex-col items-center justify-center gap-5 px-6 py-6">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={LOGO}
          alt="Behind the Stick"
          className="w-full max-w-[420px] max-h-[52vh] object-contain select-none"
          style={{ animation: "bts-logo 2.4s ease-in-out infinite" }}
          draggable={false}
        />
        <style>{`@keyframes bts-logo { 0%,100% { transform: translateY(0) rotate(-1deg) } 50% { transform: translateY(-6px) rotate(1deg) } }`}</style>
        <div className="w-full max-w-[340px] flex flex-col gap-3">
          <CabButton color={C.gold} size="lg" className="w-full" onClick={() => onPick("solo")}>
            Single Player
          </CabButton>
          <CabButton color={C.magenta} size="lg" className="w-full" onClick={() => onPick("party")}>
            Multiplayer
          </CabButton>
        </div>
      </div>
    </div>
  );
}

// ─── How to play ─────────────────────────────────────────────────────────────

interface Slide {
  /** What the bartender says. */
  say: string;
  /** Which of his faces. */
  pose: "happy" | "serve" | "worried" | "shake-up" | "stir";
  /** A picture of the thing being explained, or nothing for the opening line. */
  show?: ReactNode;
}

function slidesFor(mode: Mode, names: string[]): Slide[] {
  return [
    {
      say: "So you want to be a bartender? Well, let's see how you handle the rush and then we'll talk. If you make it through the weeds tonight, the job is yours!",
      pose: "serve",
    },
    {
      say: "First things first. Hold your phone sideways. Your left thumb works the left side, your right thumb works the right.",
      pose: "happy",
      show: <PhoneSideways />,
    },
    {
      say: "When an order comes in, stuff gets tossed in the air. Tap the bottles in COLOR. Anything grey is trouble: junk, cheap vodka, even bombs!",
      pose: "worried",
      show: <GrabPicture />,
    },
    {
      say: "Got the bottles? Build the drink. They slide down the bar. Tap each one as it lands in its TAP ring to toss it in the shaker.",
      pose: "happy",
      show: <BuildPicture />,
    },
    {
      say: "Shaken drinks: drag your right thumb up and down. Stirred drinks: make circles. Keep the meter above the line or it's watered down!",
      pose: "shake-up",
      show: <FinishPicture />,
    },
    {
      say: "Here's the rush. While you're still shaking, the next order comes up. Keep shaking with your right thumb and grab bottles with your left!",
      pose: "stir",
      show: <BothHandsPicture />,
    },
    {
      say: "Sometimes a guest wants something special. Pour a beer, line up shots, pop the bubbly. Nail it for big points!",
      pose: "happy",
      show: <MicroPicture />,
    },
    mode === "solo"
      ? {
          say: "You get three strikes. Tap a bomb, take too long, get a drink sent back or let a shake go watery, and that's one. Three and you're done.",
          pose: "worried",
          show: <StrikesPicture />,
        }
      : {
          say: "Every drink you serve, pass the phone. I'll pick who's next. Mess up once and you're out. Last one standing wins, and your team score hits the party board!",
          pose: "serve",
          show: <PartyPicture names={names} />,
        },
  ];
}

/** Letters a second the bartender talks at. */
const TALK_RATE = 55;

export function HowToSlides({
  mode,
  names,
  onBack,
  onDone,
}: {
  mode: Mode;
  names: string[];
  onBack: () => void;
  onDone: () => void;
}) {
  const slides = slidesFor(mode, names);
  const [index, setIndex] = useState(0);
  const [shown, setShown] = useState(0);
  const slide = slides[index];
  const typing = shown < slide.say.length;
  const last = index === slides.length - 1;

  useEffect(() => {
    setShown(0);
  }, [index]);

  useEffect(() => {
    if (!typing) return;
    const id = window.setTimeout(() => setShown((n) => n + 1), 1000 / TALK_RATE);
    return () => window.clearTimeout(id);
  }, [typing, shown]);

  // The first tap finishes his sentence; the next one moves on.
  const next = () => {
    if (typing) setShown(slide.say.length);
    else if (last) onDone();
    else setIndex(index + 1);
  };
  const back = () => (index === 0 ? onBack() : setIndex(index - 1));

  return (
    <div className="absolute inset-0 overflow-y-auto overscroll-contain" style={BACKDROP}>
      <div className="min-h-full flex flex-col px-4 py-4 gap-3">
        <div className="flex items-center justify-between pr-10">
          <button
            type="button"
            onClick={onDone}
            className="px-2 py-1 text-[9px] uppercase tracking-widest"
            style={{ color: C.cream, opacity: 0.6 }}
          >
            Skip
          </button>
          <div className="flex gap-1.5" aria-label={`Step ${index + 1} of ${slides.length}`}>
            {slides.map((_, i) => (
              <span
                key={i}
                className="block w-2 h-2"
                style={{ background: i === index ? C.gold : "rgba(255,233,196,0.25)" }}
              />
            ))}
          </div>
        </div>

        <div className="flex-1 flex flex-col landscape:flex-row items-center justify-center gap-4 landscape:gap-6">
          {/* The bartender and what he's saying */}
          <div
            className="flex items-end gap-2 w-full max-w-[520px] landscape:max-w-[48%] cursor-pointer"
            onClick={next}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              key={slide.pose}
              src={ART.bartender(slide.pose)}
              alt="The bartender"
              className="w-[92px] landscape:w-[110px] shrink-0 select-none"
              style={{ ...PIXELATED, animation: typing ? "bts-talk 0.28s steps(2) infinite" : undefined }}
              draggable={false}
            />
            <div
              className="relative flex-1 min-h-[96px] p-3 text-[10px] leading-[1.7] text-left"
              style={{ background: C.cream, color: C.ink, border: `3px solid ${C.ink}`, boxShadow: `4px 4px 0 ${C.ink}` }}
            >
              <span
                aria-hidden
                className="absolute -left-[11px] bottom-5 w-0 h-0"
                style={{
                  borderTop: "8px solid transparent",
                  borderBottom: "8px solid transparent",
                  borderRight: `10px solid ${C.ink}`,
                }}
              />
              <span aria-live="polite">{slide.say.slice(0, shown)}</span>
              {typing && <span className="opacity-40">▌</span>}
            </div>
          </div>

          {slide.show && (
            <div
              className="w-full max-w-[420px] landscape:max-w-[46%] flex items-center justify-center transition-opacity duration-300"
              style={{ opacity: typing ? 0.35 : 1 }}
            >
              {slide.show}
            </div>
          )}
        </div>

        <style>{`@keyframes bts-talk { 50% { transform: translateY(-3px) } }`}</style>

        <div className="grid grid-cols-[1fr_2fr] gap-2 w-full max-w-[420px] mx-auto">
          <CabButton color={C.plum} size="md" className="w-full" onClick={back}>
            Back
          </CabButton>
          <CabButton color={last && !typing ? C.gold : C.teal} size="md" className="w-full" onClick={next}>
            {last && !typing ? "Start My Shift!" : "Next"}
          </CabButton>
        </div>
      </div>
    </div>
  );
}

// ─── Pictures ────────────────────────────────────────────────────────────────

function Card({ children }: { children: ReactNode }) {
  return (
    <div
      className="w-full p-3 flex flex-col items-center gap-2"
      style={{ background: "rgba(10,4,16,0.6)", border: `3px solid ${C.plum}` }}
    >
      {children}
    </div>
  );
}

function Label({ children, color = C.cream }: { children: ReactNode; color?: string }) {
  return (
    <p className="text-[8px] uppercase tracking-wider text-center leading-relaxed" style={{ color }}>
      {children}
    </p>
  );
}

function Bottle({ ing, grey = false, size = 52 }: { ing: string; grey?: boolean; size?: number }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={ART.ingredient(ing)}
      alt=""
      style={{
        width: size,
        height: size,
        objectFit: "contain",
        filter: grey ? "grayscale(1) brightness(0.6)" : "drop-shadow(0 0 8px rgba(255,220,90,0.9))",
      }}
      draggable={false}
    />
  );
}

function Img({ src, size }: { src: string; size: number }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt="" style={{ width: size, height: size, objectFit: "contain" }} draggable={false} />;
}

function Thumb({ side }: { side: "L" | "R" }) {
  return (
    <div
      className="w-10 h-10 rounded-full flex items-center justify-center text-[10px]"
      style={{ background: side === "L" ? C.teal : C.magenta, color: C.ink, border: `3px solid ${C.ink}` }}
    >
      {side}
    </div>
  );
}

function PhoneSideways() {
  return (
    <Card>
      <div
        className="relative w-[220px] h-[110px] rounded-xl flex items-center justify-between px-3"
        style={{ border: `4px solid ${C.cream}`, background: "#140A1E" }}
      >
        <Thumb side="L" />
        <div className="flex-1 mx-2 h-[70%] rounded" style={{ background: "rgba(255,233,196,0.08)" }} />
        <Thumb side="R" />
      </div>
      <Label>Left thumb left. Right thumb right.</Label>
    </Card>
  );
}

function GrabPicture() {
  return (
    <Card>
      <div className="flex items-end gap-3">
        <div className="flex flex-col items-center gap-1">
          <Bottle ing="gin" />
          <Label color={C.gold}>Tap!</Label>
        </div>
        <div className="flex flex-col items-center gap-1">
          <Bottle ing="lime" />
          <Label color={C.gold}>Tap!</Label>
        </div>
        <div className="flex flex-col items-center gap-1">
          <Bottle ing="rum" grey />
          <Label color="#FF6A5A">Nope</Label>
        </div>
        <div className="flex flex-col items-center gap-1">
          <div className="relative w-[40px] h-[46px] flex items-end justify-center">
            <div className="w-[34px] h-[34px] rounded-full" style={{ background: "#3A3A40", border: `3px solid ${C.ink}` }} />
            <div className="absolute top-0 right-1 w-2 h-2 rounded-full" style={{ background: "#8A8A8A" }} />
          </div>
          <Label color="#FF6A5A">Boom</Label>
        </div>
      </div>
      <Label>Color = grab it. Grey = leave it.</Label>
    </Card>
  );
}

function Ring({ ing, lit = false }: { ing: string; lit?: boolean }) {
  return (
    <div
      className="w-[54px] h-[54px] rounded-full flex items-center justify-center"
      style={{
        border: `5px solid #D8A840`,
        background: "rgba(20,10,6,0.85)",
        boxShadow: lit ? "0 0 16px 4px rgba(255,220,120,0.8)" : "0 0 0 3px #140A06",
      }}
    >
      <Bottle ing={ing} size={34} />
    </div>
  );
}

function BuildPicture() {
  return (
    <Card>
      <div className="flex items-center gap-5">
        <div className="flex flex-col items-center gap-1">
          <div className="flex gap-2">
            <Ring ing="gin" lit />
            <Ring ing="lime" />
          </div>
          <Label>Left thumb</Label>
        </div>
        <div className="flex flex-col items-center gap-1">
          <div className="flex gap-2">
            <Ring ing="sugar" />
            <Ring ing="ice" lit />
          </div>
          <Label>Right thumb</Label>
        </div>
      </div>
      <Label color={C.gold}>Tap when the bottle hits the ring</Label>
    </Card>
  );
}

function FinishPicture() {
  return (
    <Card>
      <div className="flex items-center gap-6">
        <div className="flex flex-col items-center gap-1">
          <div className="flex items-center gap-1">
            <span className="text-[16px]" style={{ color: C.gold }}>↕</span>
            <Img src={ART.shaker1} size={70} />
          </div>
          <Label>Shake: up + down</Label>
        </div>
        <div className="flex flex-col items-center gap-1">
          <div className="flex items-center gap-1">
            <span className="text-[16px]" style={{ color: C.gold }}>↻</span>
            <Img src={ART.mixingGlass} size={70} />
          </div>
          <Label>Stir: circles</Label>
        </div>
      </div>
    </Card>
  );
}

function BothHandsPicture() {
  return (
    <Card>
      <div className="flex items-stretch gap-2">
        <div className="flex flex-col items-center justify-between gap-1 px-3">
          <Bottle ing="whiskey" />
          <Thumb side="L" />
          <Label>Grab</Label>
        </div>
        <div className="w-[3px]" style={{ background: C.gold, transform: "skewX(-12deg)" }} />
        <div className="flex flex-col items-center justify-between gap-1 px-3">
          <Img src={ART.shaker2} size={56} />
          <Thumb side="R" />
          <Label>Keep shaking</Label>
        </div>
      </div>
      <Label color={C.gold}>Both at once!</Label>
    </Card>
  );
}

function MicroPicture() {
  return (
    <Card>
      <div className="flex flex-col gap-2 w-full max-w-[240px]">
        {[
          ["Gimme a Beer!", "#FF9A1A"],
          ["Let's Do Shots!", "#9A3AE0"],
          ["Pop It!", "#FFC928"],
        ].map(([title, color]) => (
          <div
            key={title}
            className="px-3 py-2 text-[10px] uppercase text-center"
            style={{ background: color, color: C.ink, border: `3px solid ${C.ink}`, transform: "rotate(-1.5deg)" }}
          >
            {title}
          </div>
        ))}
      </div>
      <Label>Win big. Lose a little. You stay in.</Label>
    </Card>
  );
}

function StrikesPicture() {
  return (
    <Card>
      <div className="flex gap-3">
        {[0, 1, 2].map((i) => (
          <Img key={i} src={ART.life} size={40} />
        ))}
      </div>
      <Label>Three strikes and you&apos;re out</Label>
    </Card>
  );
}

function PartyPicture({ names }: { names: string[] }) {
  return (
    <Card>
      <div className="flex flex-wrap justify-center gap-1.5 max-w-[300px]">
        {names.map((n, i) => (
          <span
            key={`${n}-${i}`}
            className="px-2 py-1 text-[9px] uppercase"
            style={{ background: i % 2 ? C.teal : C.gold, color: C.ink, border: `2px solid ${C.ink}` }}
          >
            {n}
          </span>
        ))}
      </div>
      <Label>Serve a drink, pass the phone. Last one standing!</Label>
    </Card>
  );
}
