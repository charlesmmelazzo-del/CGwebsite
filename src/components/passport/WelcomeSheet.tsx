"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { C } from "./ui";
import { reducedMotion } from "./appEvents";
import { isIos, pushState, standalone, turnOn, markPromptDone } from "./pushClient";
import { SNOOZE_MS, iosInstallNote, welcomePlan, welcomeSteps, type PushNow, type WelcomeStep } from "@/lib/passport/welcomePrompt";

/**
 * File 16, Part 8: "Save Passport to your home screen" and "Get a message when the bar writes back", as one pop-up over
 * the app instead of cards in the page. A proper dialog: focus moves into it, Escape and a visible "Not now" close it,
 * focus goes back to where it was, the page behind doesn't scroll while it is open, and "reduce motion" is respected.
 * When it shows and what it holds is decided by lib/passport/welcomePrompt.ts.
 */

const SHOWN = "cg-passport-welcome-shown";
const SNOOZED = "cg-passport-welcome-snoozed";
// From file 12's in-page card: once Passport was installed from the prompt or opened from the home screen it is installed;
// a "Not now" there counts as a "Not now" here.
const INSTALLED = "cg-passport-installed";
const OLD_DISMISSED = "cg-passport-install-dismissed";
function read(key: string) { try { return localStorage.getItem(key); } catch { return null; } }
function store(key: string, v: string) { try { localStorage.setItem(key, v); } catch { /* storage blocked */ } }
const num = (v: string | null) => { if (!v) return null; if (v === "1") return Date.now(); const n = Number(v); return Number.isFinite(n) ? n : null; };
/** When this page load began (so the pop-up never shows in a visit's first second). */
const VISIT_START = typeof performance !== "undefined" && typeof Date !== "undefined" ? Date.now() - performance.now() : 0;

type Prompt = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };
let deferred: Prompt | null = null;
if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); deferred = e as Prompt; });
  window.addEventListener("appinstalled", () => store(INSTALLED, "1"));
}
const installedNow = () => { if (standalone()) store(INSTALLED, "1"); return standalone() || read(INSTALLED) === "1"; };

/** On Home: decides once Home has rendered, after the visit's first second, by the rules. */
export function WelcomePopup() {
  const [steps, setSteps] = useState<WelcomeStep[] | null>(null);
  const [ctx, setCtx] = useState<{ ios: boolean; installed: boolean; push: PushNow }>({ ios: false, installed: false, push: "off" });
  useEffect(() => {
    let live = true;
    const wait = Math.max(0, 1000 - (Date.now() - VISIT_START)) + 400;
    const t = setTimeout(async () => {
      const push = (await pushState().catch(() => "unsupported")) as PushNow;
      if (!live) return;
      const installed = installedNow();
      const ios = isIos();
      const snoozed = num(read(SNOOZED)) ?? num(read(OLD_DISMISSED));
      const plan = welcomePlan({ homeRendered: true, sinceVisit: Date.now() - VISIT_START, installed, push, ios, now: Date.now(), lastShown: num(read(SHOWN)), snoozed });
      if (!plan.show) return;
      store(SHOWN, String(Date.now()));
      setCtx({ ios, installed, push });
      setSteps(plan.steps);
    }, wait);
    return () => { live = false; clearTimeout(t); };
  }, []);
  if (!steps) return null;
  return <WelcomeSheet steps={steps} ios={ctx.ios} installed={ctx.installed} push={ctx.push} onClose={(how) => { if (how === "snooze") store(SNOOZED, String(Date.now())); setSteps(null); }} />;
}

/** Account → "Add Passport to your home screen": the same pop-up's install step, any time. */
export function InstallHelpButton({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [ctx, setCtx] = useState<{ ios: boolean; installed: boolean; push: PushNow }>({ ios: false, installed: false, push: "off" });
  return (
    <>
      <button type="button" onClick={async () => { const push = (await pushState().catch(() => "unsupported")) as PushNow; setCtx({ ios: isIos(), installed: installedNow(), push }); setOpen(true); }}
        className="inline-flex items-center min-h-[44px] font-body text-sm underline underline-offset-4 pp-focus rounded" style={{ color: C.text }}>{children}</button>
      {open && <WelcomeSheet steps={["install", ...welcomeSteps(ctx).filter((s) => s === "notify")]} {...ctx} forced onClose={() => setOpen(false)} />}
    </>
  );
}

function WelcomeSheet({ steps, ios, installed, push, forced = false, onClose }: { steps: WelcomeStep[]; ios: boolean; installed: boolean; push: PushNow; forced?: boolean; onClose: (how: "snooze" | "done") => void }) {
  const [host, setHost] = useState<HTMLElement | null>(null);
  const [at, setAt] = useState(0);
  const [canPrompt, setCanPrompt] = useState(!!deferred);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const panel = useRef<HTMLDivElement>(null);
  const back = useRef<Element | null>(null);
  const step = steps[at];
  const last = at >= steps.length - 1;
  const notNow = useCallback(() => onClose(forced ? "done" : "snooze"), [onClose, forced]);
  useEffect(() => { setHost(document.body); back.current = document.activeElement; }, []);
  // The page behind stays put while the pop-up is open; focus goes back where it was when it closes.
  useEffect(() => {
    const html = document.documentElement;
    const before = { h: html.style.overflow, b: document.body.style.overflow };
    html.style.overflow = "hidden"; document.body.style.overflow = "hidden";
    return () => { html.style.overflow = before.h; document.body.style.overflow = before.b; (back.current as HTMLElement | null)?.focus?.(); };
  }, []);
  useEffect(() => {
    const on = () => setCanPrompt(true);
    window.addEventListener("beforeinstallprompt", on);
    return () => window.removeEventListener("beforeinstallprompt", on);
  }, []);
  // Focus into the dialog (its heading), keep Tab inside it, Escape closes it as "Not now".
  useEffect(() => {
    if (!host) return;
    const el = panel.current;
    el?.querySelector<HTMLElement>("[data-autofocus]")?.focus();
    if (el && !reducedMotion() && el.animate) el.animate([{ transform: "translateY(24px)", opacity: 0 }, { transform: "none", opacity: 1 }], { duration: 220, easing: "ease-out" });
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); notNow(); return; }
      if (e.key !== "Tab" || !el) return;
      const f = Array.from(el.querySelectorAll<HTMLElement>("button, a[href], input, [tabindex]:not([tabindex='-1'])")).filter((x) => !x.hasAttribute("disabled"));
      if (!f.length) return;
      const first = f[0]; const end = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); end.focus(); }
      else if (!e.shiftKey && document.activeElement === end) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", key);
    return () => document.removeEventListener("keydown", key);
  }, [host, at, notNow]);
  if (!host || !step) return null;
  const next = () => { if (last) onClose("done"); else { setAt(at + 1); setNote(""); } };
  const primary = "rounded-lg px-5 min-h-[48px] font-body pp-focus text-[0.875rem] tracking-[0.22em] uppercase bg-[#C9A96E] text-[#13170F] disabled:opacity-60";
  return createPortal(
    <div className="fixed inset-0 z-[90] flex items-end md:items-center justify-center" role="presentation">
      <div aria-hidden className="absolute inset-0" style={{ background: "rgba(8,10,6,0.72)" }} onClick={notNow} />
      <div ref={panel} role="dialog" aria-modal="true" aria-labelledby="pp-welcome-title" aria-describedby="pp-welcome-body"
        className="relative w-full md:max-w-md max-h-[90dvh] overflow-y-auto rounded-t-2xl md:rounded-2xl border p-6 pb-[calc(env(safe-area-inset-bottom)+24px)]" style={{ background: C.bg, borderColor: C.line }}>
        <div className="flex items-center gap-4">
          {/* Part 10: the home-screen icon itself, so the member knows what to look for. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/passport/icons/icon-192.png" alt="" width={56} height={56} className="rounded-[14px] shrink-0" />
          <div className="min-w-0">
            <p className="pp-t-eyebrow" style={{ color: C.brass }}>{steps.length > 1 ? `Step ${at + 1} of ${steps.length}` : step === "install" ? "Keep it handy" : "Stay in the loop"}</p>
            <h2 id="pp-welcome-title" tabIndex={-1} data-autofocus className="font-display text-[1.625rem] leading-tight mt-0.5 outline-none" style={{ color: C.text }}>
              {step === "install" ? "Add Passport to your home screen" : "Get a message when the bar writes back"}
            </h2>
          </div>
        </div>
        <div id="pp-welcome-body" className="mt-4">
          {step === "install" ? (
            installed ? (
              <p className="font-body text-[1rem] leading-relaxed" style={{ color: C.muted }}>You&rsquo;re already using Passport from your home screen.</p>
            ) : ios ? (
              <>
                <ol className="font-body text-[1rem] space-y-3 leading-relaxed list-decimal pl-5" style={{ color: C.text }}>
                  <li>In Safari, tap the <strong>Share</strong> button <ShareIcon /> at the bottom of the screen.</li>
                  <li>Scroll down and tap <strong>Add to Home Screen</strong> <PlusIcon />.</li>
                  <li>Tap <strong>Add</strong>. Passport opens like an app from then on.</li>
                </ol>
                {iosInstallNote({ installed, ios, push }) && <p className="font-body text-[0.875rem] mt-3 leading-relaxed" style={{ color: C.muted }}>On iPhone, notifications from the bar work once Passport is on your home screen. Open it from there and we&rsquo;ll offer them.</p>}
              </>
            ) : canPrompt ? (
              <p className="font-body text-[1rem] leading-relaxed" style={{ color: C.muted }}>Passport opens like an app, straight from your home screen.</p>
            ) : (
              <p className="font-body text-[1rem] leading-relaxed" style={{ color: C.text }}>Open your browser&rsquo;s menu (⋮) and choose <strong>Add to Home screen</strong> or <strong>Install app</strong>.</p>
            )
          ) : (
            <p className="font-body text-[1rem] leading-relaxed" style={{ color: C.muted }}>A short note on this device when the bar replies, a bottle is ready, or a friend or a group writes. It never shows what anyone wrote. Nothing between 10 PM and 9 AM.</p>
          )}
          {note && <p className="font-body text-sm mt-3" style={{ color: C.text }} role="status">{note}</p>}
        </div>
        <div className="mt-6 flex flex-wrap items-center gap-3">
          {step === "install" && !installed && !ios && canPrompt && (
            <button type="button" disabled={busy} className={primary} onClick={async () => {
              if (!deferred) return;
              setBusy(true);
              await deferred.prompt();
              const choice = await deferred.userChoice.catch(() => null);
              deferred = null; setCanPrompt(false); setBusy(false);
              if (choice?.outcome === "accepted") { store(INSTALLED, "1"); next(); }
            }}>Add to home screen</button>
          )}
          {step === "install" && (installed || ios || !canPrompt) && <button type="button" className={primary} onClick={next}>{last ? "Done" : "Next"}</button>}
          {step === "notify" && (
            <button type="button" disabled={busy} className={primary} onClick={async () => {
              setBusy(true);
              const r = await turnOn();
              setBusy(false);
              markPromptDone("answered");
              if (r.state === "on") { next(); return; }
              setNote(r.state === "blocked" ? "Notifications are blocked for this site in your browser's settings." : r.error || "Notifications weren't turned on. You can turn them on any time in Account.");
            }}>{busy ? "Turning on…" : "Turn on"}</button>
          )}
          <button type="button" onClick={notNow} className="font-body text-[0.9375rem] underline underline-offset-4 min-h-[48px] px-2 pp-focus rounded" style={{ color: C.muted }}>{forced ? "Close" : "Not now"}</button>
        </div>
        {!forced && <p className="pp-t-secondary mt-3" style={{ color: C.faint }}>&ldquo;Not now&rdquo; keeps this away for {Math.round(SNOOZE_MS / 86400000)} days. Account has both any time.</p>}
      </div>
    </div>,
    host,
  );
}

function ShareIcon() {
  return (
    <svg className="inline -mt-1" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" role="img" aria-label="Share">
      <path d="M12 3v12M8 7l4-4 4 4" /><path d="M6 11H5v10h14V11h-1" />
    </svg>
  );
}
function PlusIcon() {
  return (
    <svg className="inline -mt-1" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <rect x="4" y="4" width="16" height="16" rx="3" /><path d="M12 8v8M8 12h8" />
    </svg>
  );
}
