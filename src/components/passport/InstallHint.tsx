"use client";

import { useEffect, useState } from "react";
import { C } from "./ui";

/**
 * "Save Passport to your home screen". iPhone has no install prompt, so it gets
 * short instructions; Android offers the browser's own install prompt.
 * Shown once after signing in; dismissing it is remembered on this device, and
 * the account screen can open it again. Hidden when already opened from the home screen.
 */

const DISMISSED = "cg-passport-install-dismissed";
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
    const isInstalled = standalone();
    setInstalled(isInstalled);
    let dismissed = false;
    try { dismissed = localStorage.getItem(DISMISSED) === "1"; } catch { /* storage blocked */ }
    // After sign-in it stays on the home screen until dismissed; never when already installed.
    if (force || (!dismissed && !isInstalled)) setShow(true);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, [force]);

  const close = () => {
    try { localStorage.setItem(DISMISSED, "1"); } catch { /* storage blocked */ }
    setShow(false);
    onClose?.();
  };

  if (!show) return null;
  return (
    <section className="rounded-xl border p-5 mb-6 animate-fade-in relative" style={{ borderColor: C.brass + "66", background: "#1a1f14" }}>
      <button type="button" onClick={close} aria-label="Dismiss" className="absolute top-1.5 right-1.5 w-11 h-11 text-xl leading-none pp-focus rounded-full" style={{ color: C.muted }}>×</button>
      <p className="font-body text-[11px] tracking-[0.3em] uppercase" style={{ color: C.brass }}>Keep it handy</p>
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
          <button type="button" className="rounded-lg px-5 py-3 font-body text-[12px] tracking-[0.22em] uppercase bg-[#C9A96E] text-[#13170F]"
            onClick={async () => { if (!deferred) return; await deferred.prompt(); deferred = null; setCanPrompt(false); close(); }}>
            Add to home screen
          </button>
        </div>
      ) : (
        <p className="font-body text-sm mt-3 leading-relaxed" style={{ color: C.text }}>
          Open your browser&rsquo;s menu (⋮) and choose <strong>Add to Home screen</strong> or <strong>Install app</strong>.
        </p>
      )}
      <button type="button" onClick={close} className="font-body text-xs underline underline-offset-4 mt-2 min-h-[44px] px-1 -ml-1 pp-focus" style={{ color: C.muted }}>Not now</button>
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
