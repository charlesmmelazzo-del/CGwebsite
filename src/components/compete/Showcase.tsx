"use client";

// The partner showcase: a tap-through tour of a competition night for
// prospective brand partners, with the real guest screens running inside a
// phone. Lives at the unlinked /compete/showcase.

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowLeft, ArrowRight, Check, Loader2 } from "lucide-react";
import type { LiveState, PublicEvent, Viewer } from "@/lib/compete/types";
import GuestApp, { type Tab } from "./GuestApp";
import JoinScreen from "./JoinScreen";
import { accentStyle } from "./Profiles";

const GUEST: Viewer = {
  codeId: "showcase",
  code: "K7QM4P",
  tierId: "general",
  tierLabel: "General Admission",
  isJudge: false,
  name: "",
};

const base: LiveState = { phase: "lobby", closed: [], revealed: [] };
const JUDGES = [
  { name: "Elena Park", scores: { presentation: 5, flavor: 4, balance: 4, creativity: 5 } },
  { name: "Sam Whitaker", scores: { presentation: 4, flavor: 5, balance: 4, creativity: 4 } },
  { name: "Rosa Delgado", scores: { presentation: 5, flavor: 5, balance: 4, creativity: 4 } },
];
const ON_STAGE = "c1";

type Phone =
  | { kind: "join" }
  | { kind: "app"; state: LiveState; tab: Tab; viewer: Viewer | null };

type Step = {
  eyebrow: string;
  title: string;
  body: ReactNode;
  why?: string;
  phone?: Phone;
  /** The closing step shows the interest form instead of a phone. */
  form?: boolean;
};

const STEPS: Step[] = [
  {
    eyebrow: "Partner Preview",
    title: "A cocktail competition, built around your brand.",
    body: (
      <>
        A live, game-show-style night at Common Good where local bartenders compete with your spirit — and every guest in
        the room follows along, votes, and takes your brand home on their phone.
      </>
    ),
    why: "Shown here with our partner Tequila Cascahuín. Bartenders and cocktails are illustrative.",
    phone: { kind: "app", state: base, tab: "live", viewer: GUEST },
  },
  {
    eyebrow: "Arrival",
    title: "Every guest gets a ticket.",
    body: "Each ticket carries a personal code and a QR code. Guests scan it and they’re in — no app to download, no account to create.",
    why: "Your logo is the first thing on every phone in the room.",
    phone: { kind: "join" },
  },
  {
    eyebrow: "Before the First Pour",
    title: "Guests settle in and explore.",
    body: "While the room fills, guests browse tonight’s featured spirit and the lineup of bartenders. When the host begins, every phone follows along automatically.",
    phone: { kind: "app", state: base, tab: "live", viewer: GUEST },
  },
  {
    eyebrow: "Your Brand Page",
    title: "Your story, in every guest’s hand.",
    body: "Your photos, your story, your full range of products, and links to your website and socials — presented the way a premium brand deserves.",
    why: "You fill it in yourself from a private link. Nothing to print or ship.",
    phone: { kind: "app", state: base, tab: "brand", viewer: GUEST },
  },
  {
    eyebrow: "The Lineup",
    title: "Bartenders building around your spirit.",
    body: "We invite talented bartenders from local bars. Each one creates an original cocktail that puts your spirit front and center.",
    phone: { kind: "app", state: base, tab: "lineup", viewer: GUEST },
  },
  {
    eyebrow: "Now Presenting",
    title: "The host brings each bartender to the stage.",
    body: "One bartender at a time. The moment the host presents them, every phone in the room switches to their profile — live.",
    phone: { kind: "app", state: { ...base, phase: "contestant", contestantId: ON_STAGE, step: "bartender" }, tab: "live", viewer: GUEST },
  },
  {
    eyebrow: "The Cocktail",
    title: "Then the drink itself.",
    body: "Ingredients, inspiration, and the story behind it — while our staff pours a tasting for every guest and the bartender builds the showpiece version for the judges.",
    phone: { kind: "app", state: { ...base, phase: "contestant", contestantId: ON_STAGE, step: "cocktail" }, tab: "live", viewer: GUEST },
  },
  {
    eyebrow: "The Judges",
    title: "The judges reveal their scores.",
    body: "Our judges taste, react, and score first. Then the host reveals their marks — by name, all at once — on every phone in the room.",
    why: "This is where the room gets loud.",
    phone: {
      kind: "app",
      state: {
        ...base,
        phase: "contestant",
        contestantId: ON_STAGE,
        step: "voting",
        judgeVoting: true,
        judgeReveal: { contestantId: ON_STAGE, judges: JUDGES },
      },
      tab: "live",
      viewer: GUEST,
    },
  },
  {
    eyebrow: "The Room Votes",
    title: "Then every guest scores it.",
    body: "One to five stars for presentation, flavor, balance, and creativity. Go ahead — tap the stars on the phone and submit a score.",
    why: "Guests stay engaged with your spirit for the entire night, cocktail after cocktail.",
    phone: {
      kind: "app",
      state: { ...base, phase: "contestant", contestantId: ON_STAGE, step: "voting", judgeVoting: true, guestVoting: true },
      tab: "live",
      viewer: GUEST,
    },
  },
  {
    eyebrow: "Superlatives",
    title: "Fun awards keep everyone playing.",
    body: "After the last cocktail, guests pick winners for awards like Best Garnish and Crowd Favorite. Try making a pick.",
    phone: { kind: "app", state: { ...base, phase: "superlatives", superlativesOpen: true }, tab: "live", viewer: GUEST },
  },
  {
    eyebrow: "The Winners",
    title: "The host reveals the winners.",
    body: "One award at a time, building to the overall champion. Scores stay private — only the winners are revealed.",
    phone: {
      kind: "app",
      state: {
        ...base,
        phase: "reveal",
        revealed: [
          { key: "best_garnish", label: "Best Garnish", contestantId: "c6" },
          { key: "crowd_favorite", label: "Crowd Favorite", contestantId: "c5" },
          { key: "overall", label: "Overall Winner", contestantId: "c1" },
        ],
      },
      tab: "live",
      viewer: GUEST,
    },
  },
  {
    eyebrow: "The Take-Home",
    title: "Your spirit goes home with every guest.",
    body: "Guests open a collection of at-home recipes featuring your spirit and save each one to their camera roll as a beautiful recipe card. Open one and try “Save to Photos.”",
    why: "A lasting, shareable reminder of your brand — long after the night ends.",
    phone: { kind: "app", state: { ...base, phase: "reveal" }, tab: "home", viewer: GUEST },
  },
  {
    eyebrow: "After the Night",
    title: "The event lives on.",
    body: "Each competition stays on our website under Past Competitions — winners, your brand profile, and the recipes — a permanent showcase for your partnership.",
    phone: {
      kind: "app",
      state: {
        ...base,
        phase: "finished",
        revealed: [
          { key: "crowd_favorite", label: "Crowd Favorite", contestantId: "c5" },
          { key: "best_name", label: "Best Cocktail Name", contestantId: "c3" },
          { key: "best_garnish", label: "Best Garnish", contestantId: "c6" },
          { key: "funniest", label: "Funniest Cocktail", contestantId: "c2" },
          { key: "overall", label: "Overall Winner", contestantId: "c1" },
        ],
      },
      tab: "live",
      viewer: null,
    },
  },
  {
    eyebrow: "Let’s Plan Yours",
    title: "What we need from you.",
    body: (
      <ul className="space-y-3">
        {[
          "Your logo, a few photos, and a short brand story — submitted from a private link.",
          "Details on the products you’d like to feature.",
          "Product for the competition — we’ll work out quantities together.",
          "That’s it. We handle the bartenders, tickets, hosting, judges, and the night itself.",
        ].map((t) => (
          <li key={t} className="flex gap-3">
            <Check size={16} className="mt-1 shrink-0 text-[var(--cmp-accent)]" />
            <span>{t}</span>
          </li>
        ))}
      </ul>
    ),
    form: true,
    phone: { kind: "app", state: { ...base, phase: "finished" }, tab: "brand", viewer: null },
  },
];

// ─── Phone frame ─────────────────────────────────────────────────────────────

const PHONE_W = 390;
const PHONE_H = 800;

function usePhoneScale() {
  const [scale, setScale] = useState(0.8);
  useEffect(() => {
    const fit = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      const s = w < 1024 ? Math.min((w - 48) / PHONE_W, (h * 0.7) / PHONE_H) : Math.min(1, (h - 150) / PHONE_H);
      setScale(Math.max(0.5, Math.min(1, s)));
    };
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, []);
  return scale;
}

function PhoneFrame({ children, scale }: { children: ReactNode; scale: number }) {
  return (
    <div style={{ width: PHONE_W * scale, height: PHONE_H * scale }} className="shrink-0 mx-auto">
      {/* The transform also makes the guest app's fixed header and tab bar
          sit inside the phone instead of the browser window. */}
      <div
        style={{ width: PHONE_W, height: PHONE_H, transform: `scale(${scale})`, transformOrigin: "top left" }}
        className="relative rounded-[48px] border-[10px] border-[#2a2925] bg-[#12110e] shadow-[0_30px_80px_rgba(0,0,0,0.55)] overflow-hidden"
      >
        <div data-phone-scroller className="absolute inset-0 overflow-y-auto overflow-x-hidden cmp-scroll-x">
          {children}
        </div>
      </div>
    </div>
  );
}

// ─── Interest form ───────────────────────────────────────────────────────────

function InterestForm() {
  const [f, setF] = useState({ name: "", brand: "", email: "", phone: "", message: "" });
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const set = (k: keyof typeof f, v: string) => setF((x) => ({ ...x, [k]: v }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setState("sending");
    try {
      const res = await fetch("/api/forms/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          formId: "competition-partner-inquiry",
          formName: "Competition Partner Inquiry",
          data: { name: f.name, brand: f.brand, email: f.email, phone: f.phone, message: f.message },
        }),
      });
      if (!res.ok) throw new Error();
      setState("sent");
    } catch {
      setState("error");
    }
  }

  if (state === "sent") {
    return (
      <div className="cmp-card p-8 text-center cmp-rise">
        <Check className="mx-auto text-[var(--cmp-accent)]" size={28} />
        <h3 className="cmp-display text-3xl mt-4">Thank you!</h3>
        <p className="mt-3 cmp-muted">We’ve got your details and will be in touch soon to start planning.</p>
      </div>
    );
  }

  const field = "cmp-input !py-3";
  return (
    <form onSubmit={submit} className="cmp-card p-6 md:p-8 space-y-4">
      <div className="cmp-label">I’m Interested</div>
      <div className="grid sm:grid-cols-2 gap-4">
        <input required placeholder="Your name *" className={field} value={f.name} onChange={(e) => set("name", e.target.value)} autoComplete="name" />
        <input required placeholder="Brand / company *" className={field} value={f.brand} onChange={(e) => set("brand", e.target.value)} autoComplete="organization" />
        <input required type="email" placeholder="Email *" className={field} value={f.email} onChange={(e) => set("email", e.target.value)} autoComplete="email" />
        <input type="tel" placeholder="Phone" className={field} value={f.phone} onChange={(e) => set("phone", e.target.value)} autoComplete="tel" />
      </div>
      <textarea
        rows={4}
        placeholder="Tell us about your brand and when you’d like to host"
        className={`${field} resize-y`}
        value={f.message}
        onChange={(e) => set("message", e.target.value)}
      />
      {state === "error" && <p className="text-sm text-red-300">Something went wrong — please try again, or email hello@cgcocktails.com.</p>}
      <button type="submit" className="cmp-btn w-full" disabled={state === "sending"}>
        {state === "sending" && <Loader2 size={15} className="animate-spin" />} Let’s Talk
      </button>
    </form>
  );
}

// ─── The tour ────────────────────────────────────────────────────────────────

export default function Showcase({ ev }: { ev: PublicEvent }) {
  const [i, setI] = useState(0);
  const scale = usePhoneScale();
  const top = useRef<HTMLDivElement>(null);
  const step = STEPS[i];
  const last = STEPS.length - 1;

  const go = useCallback((n: number) => {
    setI(Math.max(0, Math.min(STEPS.length - 1, n)));
    top.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest("input, textarea")) return;
      if (e.key === "ArrowRight") go(i + 1);
      if (e.key === "ArrowLeft") go(i - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [i, go]);

  const phone = step.phone;
  // The recap screens read the event's status as well as the live phase.
  const finishedEv: PublicEvent = { ...ev, status: phone?.kind === "app" && phone.state.phase === "finished" ? "finished" : ev.status };

  return (
    <div className="cmp min-h-[100dvh] flex flex-col" style={accentStyle(ev.accentColor)} ref={top}>
      <header className="h-16 shrink-0 px-6 border-b border-[var(--cmp-line)] flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img src={ev.commonGoodLogo} alt="Common Good Cocktail House" className="h-9 w-auto" />
          <span className="text-[11px] tracking-[0.22em] uppercase cmp-muted hidden sm:inline">Common Good Cocktail House</span>
        </div>
        <span className="cmp-label !text-[10px]">Partner Preview</span>
      </header>

      <main className="flex-1 mx-auto w-full max-w-6xl px-6 py-8 lg:py-10 grid lg:grid-cols-[minmax(0,1fr)_auto] gap-10 lg:gap-20 items-center">
        {/* Words */}
        <section key={i} className="cmp-rise max-w-xl">
          <div className="text-xs tracking-[0.2em] uppercase cmp-faint tabular-nums">
            {String(i + 1).padStart(2, "0")} / {String(STEPS.length).padStart(2, "0")}
          </div>
          <div className="cmp-label mt-5">{step.eyebrow}</div>
          <h1 className={`cmp-display mt-4 ${i === 0 ? "text-5xl md:text-6xl" : "text-4xl md:text-5xl"}`}>{step.title}</h1>
          <div className="mt-6 text-[17px] leading-relaxed cmp-muted">{step.body}</div>
          {step.why && (
            <p className="mt-6 pl-4 border-l-2 border-[var(--cmp-accent)] text-[15px] leading-relaxed text-[var(--cmp-text)]">{step.why}</p>
          )}
          {step.form && (
            <div className="mt-10">
              <InterestForm />
            </div>
          )}

          {/* Desktop controls */}
          <div className="hidden lg:flex items-center gap-3 mt-12">
            <button onClick={() => go(i - 1)} disabled={i === 0} className="cmp-btn-ghost !px-4" aria-label="Back">
              <ArrowLeft size={16} />
            </button>
            {i < last && (
              <button onClick={() => go(i + 1)} className="cmp-btn">
                {i === 0 ? "Take the Tour" : "Next"} <ArrowRight size={16} />
              </button>
            )}
          </div>
        </section>

        {/* Phone */}
        {phone ? (
          <div className="flex justify-center">
            <PhoneFrame scale={scale}>
              {phone.kind === "join" ? (
                <JoinScreen ev={ev} initialCode="K7QM4P" onSimJoin={() => go(i + 1)} />
              ) : (
                <GuestApp
                  ev={finishedEv}
                  initialLive={{ version: 0, state: phone.state, status: finishedEv.status }}
                  viewer={phone.viewer}
                  sim={{ state: phone.state, tab: phone.tab, step: i }}
                />
              )}
            </PhoneFrame>
          </div>
        ) : (
          <div className="hidden lg:block" style={{ width: PHONE_W * scale }} />
        )}
      </main>

      {/* Progress + mobile controls */}
      <footer className="sticky bottom-0 bg-[var(--cmp-bg)]/95 backdrop-blur border-t border-[var(--cmp-line)]">
        <div className="mx-auto max-w-6xl px-6 h-16 flex items-center gap-4">
          <button onClick={() => go(i - 1)} disabled={i === 0} className="lg:hidden p-2 disabled:opacity-30" aria-label="Back">
            <ArrowLeft size={20} />
          </button>
          <div className="flex-1 flex items-center justify-center gap-1.5">
            {STEPS.map((_, n) => (
              <button
                key={n}
                onClick={() => go(n)}
                aria-label={`Go to step ${n + 1}`}
                className="h-6 flex items-center"
              >
                <span
                  className="block h-[3px] transition-all"
                  style={{
                    width: n === i ? 28 : 12,
                    background: n <= i ? "var(--cmp-accent)" : "var(--cmp-line)",
                  }}
                />
              </button>
            ))}
          </div>
          <button onClick={() => go(i + 1)} disabled={i === last} className="lg:hidden p-2 disabled:opacity-30" aria-label="Next">
            <ArrowRight size={20} />
          </button>
        </div>
      </footer>
    </div>
  );
}
