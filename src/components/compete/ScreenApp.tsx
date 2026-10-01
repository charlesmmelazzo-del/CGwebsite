"use client";

// The optional big-screen view for a TV or projector. Follows the host just
// like the phones do, with type sized to read from across the room.

import type { LiveState, PublicContestant, PublicEvent } from "@/lib/compete/types";
import { formatEventDate } from "@/lib/compete/defaults";
import {
  accentStyle,
  bartenderBar,
  bartenderName,
  brandLogos,
  CocktailPlaceholder,
  cocktailName,
  LogoLockup,
  Monogram,
} from "./Profiles";
import { JudgeReveal, useLive, WinnerCard } from "./live";

export default function ScreenApp({
  ev,
  initialLive,
  joinUrl,
  qrSvg,
}: {
  ev: PublicEvent;
  initialLive: { version: number; state: LiveState; status: string };
  joinUrl: string;
  qrSvg: string;
}) {
  const { state: s } = useLive(ev.slug, initialLive);
  const byId = new Map(ev.contestants.map((c) => [c.id, c]));
  const c = s.contestantId ? byId.get(s.contestantId) : undefined;
  const logos = brandLogos(ev.sponsors);

  return (
    <div className="cmp h-screen w-screen overflow-hidden flex flex-col" style={accentStyle(ev.accentColor)}>
      <header className="flex items-center justify-between px-12 h-24 border-b border-[var(--cmp-line)] shrink-0">
        <LogoLockup cgLogo={ev.commonGoodLogo} brandLogos={logos.slice(0, 2)} />
        <div className="cmp-display text-3xl">{ev.name}</div>
      </header>

      <main className="flex-1 min-h-0 flex">
        {s.phase === "lobby" && (
          <div className="flex-1 flex items-center justify-center gap-24 px-16 cmp-rise">
            <div className="text-center max-w-3xl">
              <LogoLockup cgLogo={ev.commonGoodLogo} brandLogos={logos.slice(0, 1)} size="lg" />
              <div className="cmp-label !text-base mt-16">Common Good Presents</div>
              <h1 className="cmp-display text-8xl mt-6">{ev.name}</h1>
              {ev.featuredSpirit && <p className="mt-8 text-3xl italic cmp-muted">featuring {ev.featuredSpirit}</p>}
              <p className="mt-10 text-xl tracking-[0.2em] uppercase cmp-faint">{formatEventDate(ev.eventDate)}</p>
            </div>
            <div className="text-center">
              <div className="bg-[#f2ede3] p-5 w-72 h-72" dangerouslySetInnerHTML={{ __html: qrSvg }} />
              <p className="mt-6 text-lg cmp-muted">Scan, then enter your ticket code</p>
              <p className="mt-2 text-base cmp-faint">{joinUrl.replace(/^https?:\/\//, "")}</p>
            </div>
          </div>
        )}

        {s.phase === "contestant" && c && s.step === "bartender" && <BartenderSlide ev={ev} c={c} />}
        {s.phase === "contestant" && c && s.step === "cocktail" && <CocktailSlide ev={ev} c={c} />}
        {s.phase === "contestant" && c && s.step === "voting" && (
          <div className="flex-1 flex flex-col items-center justify-center px-16 cmp-rise" key={`v-${c.id}`}>
            <div className="cmp-label !text-lg">{(s.closed ?? []).includes(c.id) ? "Voting Closed" : "Now Scoring"}</div>
            <h2 className="cmp-display text-8xl mt-6 text-center">{cocktailName(ev.cocktailFields, c.cocktail)}</h2>
            <p className="mt-4 text-2xl tracking-[0.18em] uppercase cmp-muted">by {bartenderName(ev.bartenderFields, c.bartender)}</p>
            {s.judgeReveal?.contestantId === c.id ? (
              <div className="mt-16 w-full max-w-6xl">
                <JudgeReveal judges={s.judgeReveal.judges} categories={ev.scoreCategories} big />
              </div>
            ) : (
              <p className="mt-16 text-3xl cmp-muted">
                {s.guestVoting ? "Guest voting is open — score it on your phone." : s.judgeVoting ? "The judges are scoring…" : ""}
              </p>
            )}
          </div>
        )}

        {s.phase === "superlatives" && (
          <div className="flex-1 flex flex-col items-center justify-center px-16 cmp-rise">
            <div className="cmp-label !text-lg">The Superlatives</div>
            <h2 className="cmp-display text-8xl mt-6">{s.superlativesOpen ? "Cast your picks" : "Picks are in"}</h2>
            <div className="mt-14 flex flex-wrap justify-center gap-6 max-w-5xl">
              {ev.superlatives.map((x) => (
                <div key={x.id} className="cmp-card px-8 py-5 cmp-display text-3xl">
                  {x.label}
                </div>
              ))}
            </div>
          </div>
        )}

        {(s.phase === "reveal" || s.phase === "finished") && <RevealSlide ev={ev} s={s} byId={byId} />}
      </main>
    </div>
  );
}

function BartenderSlide({ ev, c }: { ev: PublicEvent; c: PublicContestant }) {
  const name = bartenderName(ev.bartenderFields, c.bartender);
  const answers = ev.bartenderFields.filter((f) => !f.role && c.bartender[f.id]);
  return (
    <div className="flex-1 flex cmp-rise" key={`b-${c.id}`}>
      <div className="w-[42%] h-full">
        {c.bartender.photoUrl ? (
          <img src={c.bartender.photoUrl} alt="" className="w-full h-full object-cover" />
        ) : (
          <Monogram name={name} className="w-full h-full" textClass="text-[12rem] opacity-80" />
        )}
      </div>
      <div className="flex-1 px-20 py-16 flex flex-col justify-center overflow-hidden">
        <div className="cmp-label !text-lg">Now Presenting</div>
        <h2 className="cmp-display text-8xl mt-5">{name}</h2>
        <p className="mt-4 text-3xl tracking-[0.16em] uppercase cmp-muted">{bartenderBar(ev.bartenderFields, c.bartender)}</p>
        <div className="mt-14 space-y-10 max-w-4xl">
          {answers.map((f) => (
            <div key={f.id}>
              <div className="cmp-label !text-base">{f.label}</div>
              <p className="mt-3 text-2xl leading-relaxed cmp-muted line-clamp-4">{c.bartender[f.id]}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function CocktailSlide({ ev, c }: { ev: PublicEvent; c: PublicContestant }) {
  const fields = ev.cocktailFields.filter((f) => !f.role && c.cocktail[f.id]);
  return (
    <div className="flex-1 flex cmp-rise" key={`c-${c.id}`}>
      <div className="w-[42%] h-full">
        {c.cocktail.photoUrl ? (
          <img src={c.cocktail.photoUrl} alt="" className="w-full h-full object-cover" />
        ) : (
          <CocktailPlaceholder className="w-full h-full" />
        )}
      </div>
      <div className="flex-1 px-20 py-16 flex flex-col justify-center overflow-hidden">
        <div className="cmp-label !text-lg">The Cocktail</div>
        <h2 className="cmp-display text-8xl mt-5">{cocktailName(ev.cocktailFields, c.cocktail)}</h2>
        <p className="mt-4 text-2xl tracking-[0.16em] uppercase cmp-muted">
          by {bartenderName(ev.bartenderFields, c.bartender)} · {bartenderBar(ev.bartenderFields, c.bartender)}
        </p>
        <div className="mt-14 grid grid-cols-2 gap-14 max-w-5xl">
          {fields.map((f) => (
            <div key={f.id}>
              <div className="cmp-label !text-base">{f.label}</div>
              <p className="mt-3 text-2xl leading-relaxed cmp-muted whitespace-pre-line line-clamp-[9]">{c.cocktail[f.id]}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function RevealSlide({ ev, s, byId }: { ev: PublicEvent; s: LiveState; byId: Map<string, PublicContestant> }) {
  const revealed = (s.revealed ?? []).filter((r) => r.contestantId);
  const latest = revealed[revealed.length - 1];
  if (s.phase === "finished") {
    return (
      <div className="flex-1 flex flex-col items-center justify-center px-16 cmp-rise">
        <h2 className="cmp-display text-7xl">Congratulations</h2>
        <div className="mt-12 grid grid-cols-3 gap-6 w-full max-w-7xl">
          {revealed.map((r) => (
            <WinnerCard key={r.key} ev={ev} label={r.label} contestant={byId.get(r.contestantId)} />
          ))}
        </div>
      </div>
    );
  }
  if (!latest) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center cmp-rise">
        <div className="cmp-label !text-lg">The Results</div>
        <h2 className="cmp-display text-8xl mt-6">And the winners are…</h2>
      </div>
    );
  }
  return (
    <div className="flex-1 flex items-center justify-center px-16" key={latest.key}>
      <div className="w-full max-w-3xl">
        <WinnerCard ev={ev} label={latest.label} contestant={byId.get(latest.contestantId)} fresh big />
      </div>
    </div>
  );
}
