"use client";

import { useEffect, useState } from "react";
import { C } from "./ui";

/**
 * "Save Passport to your home screen". iPhone has no install prompt, so it gets
 * short instructions; Android offers the browser's own install prompt.
 * Shown on Home after signing in; "Not now" keeps it away for 30 days on this device, and
 * the account screen can open it again. Never shown once Passport is installed.
 */

const DISMISSED = "cg-passport-install-dismissed";
// File 12: "Not now" keeps it away for 30 days (stored as the time it was tapped; the old "1" counts as just now), and
// once Passport has been opened from the home screen (or installed from the prompt) it never shows again on this device.
const INSTALLED = "cg-passport-installed";
const QUIET_MS = 30 * 24 * 60 * 60 * 1000;
function store(key: string, value: string) { try { localStorage.setItem(key, value); } catch { /* storage blocked */ } }
function read(key: string) { try { return localStorage.getItem(key); } catch { return null; } }
function dismissedRecently() {
  const v = read(DISMISSED);
  if (!v) return false;
  if (v === "1") { store(DISMISSED, String(Date.now())); return true; }
  const at = Number(v);
  return Number.isFinite(at) && Date.now() - at < QUIET_MS;
}
/** File 13: whether the card would show on Home right now (the notifications prompt waits until it doesn't). */
export function installHintShowing(): boolean {
  if (typeof window === "undefined") return false;
  const installed = standalone() || read(INSTALLED) === "1";
  return !installed && !dismissedRecently();
}
type Prompt = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

function standalone() {
  return window.matchMedia("(display-mode: standalone)").matches || (navigator as unknown as { standalone?: boolean }).standalone === true;
}
const isIos = () => {
  const ua = navigator.userAgent;
  if (/android/i.test(ua)) return false;
  // iPads report themselves as a Mac with a touch screen.
  return /iphone|ipad|ipod/i.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
};

let deferred: Prompt | null = null;
if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); deferred = e as Prompt; });
}

export default function InstallHint({ force = false, onClose }: { force?: boolean; onClose?: () => void }) {
  const [show, setShow] = useState(false);
  const [ios, setIos] = useState(false);
  const [canPrompt, setCanPrompt] = useState(false);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    setIos(isIos());
    setCanPrompt(!!deferred);
    const onPrompt = () => setCanPrompt(true);
    window.addEventListener("beforeinstallprompt", onPrompt);
    const onInstalled = () => { store(INSTALLED, "1"); setShow(false); };
    window.addEventListener("appinstalled", onInstalled);
    if (standalone()) store(INSTALLED, "1");
    const isInstalled = standalone() || read(INSTALLED) === "1";
    setInstalled(isInstalled);
    // On Home until "Not now" (then away for 30 days); never once installed. The account screen can always open it.
    if (force || (!dismissedRecently() && !isInstalled)) setShow(true);
    return () => { window.removeEventListener("beforeinstallprompt", onPrompt); window.removeEventListener("appinstalled", onInstalled); };
  }, [force]);

  const close = () => {
    if (!force) store(DISMISSED, String(Date.now()));
    setShow(false);
    onClose?.();
  };

  if (!show) return null;
  return (
    <section className="rounded-xl border p-5 mb-6 animate-fade-in relative" style={{ borderColor: C.brass + "66", background: "#1a1f14" }}>
      <button type="button" onClick={close} aria-label="Not now" title="Not now" className="absolute top-1.5 right-1.5 w-11 h-11 text-xl leading-none pp-focus rounded-full" style={{ color: C.muted }}>×</button>
      <p className="font-body text-[0.75rem] tracking-[0.3em] uppercase" style={{ color: C.brass }}>Keep it handy</p>
      <h2 className="font-display text-2xl mt-1" style={{ color: C.text }}>Save Passport to your home screen</h2>
      {installed ? (
        <p className="font-body text-sm mt-3 leading-relaxed" style={{ color: C.muted }}>You&rsquo;re already using Passport from your home screen.</p>
      ) : ios ? (
        <ol className="font-body text-sm mt-3 space-y-2 leading-relaxed list-decimal pl-5" style={{ color: C.text }}>
          <li>In Safari, tap the <strong>Share</strong> button <ShareIcon /> at the bottom of the screen.</li>
          <li>Scroll down and tap <strong>Add to Home Screen</strong>.</li>
          <li>Tap <strong>Add</strong>. Passport opens like an app from then on.</li>
        </ol>
      ) : canPrompt ? (
        <div className="mt-4">
          <button type="button" className="rounded-lg px-5 min-h-[44px] font-body pp-focus text-[0.875rem] tracking-[0.22em] uppercase bg-[#C9A96E] text-[#13170F]"
            onClick={async () => { if (!deferred) return; await deferred.prompt(); const choice = await deferred.userChoice.catch(() => null); deferred = null; setCanPrompt(false); if (choice?.outcome === "accepted") store(INSTALLED, "1"); close(); }}>
            Add to home screen
          </button>
        </div>
      ) : (
        <p className="font-body text-sm mt-3 leading-relaxed" style={{ color: C.text }}>
          Open your browser&rsquo;s menu (⋮) and choose <strong>Add to Home screen</strong> or <strong>Install app</strong>.
        </p>
      )}
      <button type="button" onClick={close} className="font-body text-[0.875rem] underline underline-offset-4 mt-2 min-h-[44px] px-1 -ml-1 pp-focus" style={{ color: C.muted }}>Not now</button>
    </section>
  );
}

function ShareIcon() {
  return (
    <svg className="inline -mt-1" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-label="Share">
      <path d="M12 3v12M8 7l4-4 4 4" /><path d="M6 11H5v10h14V11h-1" />
    </svg>
  );
}
