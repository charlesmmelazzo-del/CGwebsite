"use client";

import { useEffect, useState } from "react";
import { C } from "./ui";
import { installHintShowing } from "./InstallHint";
import { markPromptDone, promptDone, pushState, turnOn, usedForABit } from "./pushClient";

/**
 * File 13: a one-time card on Home offering notifications on this device. Never on a first open: only once the member
 * has opened Passport a few times on at least two days, never while "Save Passport to your home screen" is showing,
 * and never on an iPhone before Passport is on the home screen (notifications only work there). The browser's own
 * permission box opens only after the member taps "Turn on". "Not now" hides it for good on this device; Account →
 * Notifications always has the switch.
 */
export default function PushPrompt() {
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");

  useEffect(() => {
    let live = true;
    if (promptDone() || !usedForABit() || installHintShowing()) return;
    pushState().then((s) => { if (live && s === "off") setShow(true); });
    return () => { live = false; };
  }, []);

  if (!show) return null;
  const close = (how: "dismissed" | "answered") => { markPromptDone(how); setShow(false); };
  return (
    <section className="rounded-xl border p-5 mt-12 animate-fade-in relative" style={{ borderColor: C.brass + "66", background: "#1a1f14" }} aria-labelledby="pp-push-title">
      <button type="button" onClick={() => close("dismissed")} aria-label="Not now" title="Not now" className="absolute top-1.5 right-1.5 w-11 h-11 text-xl leading-none pp-focus rounded-full" style={{ color: C.muted }}>×</button>
      <p className="font-body text-[0.75rem] tracking-[0.3em] uppercase" style={{ color: C.brass }}>Stay in the loop</p>
      <h2 id="pp-push-title" className="font-display text-2xl mt-1 pr-8" style={{ color: C.text }}>Get a notification when the bar writes back</h2>
      <p className="font-body text-sm mt-2 leading-relaxed" style={{ color: C.muted }}>
        A short note on this phone when the bar replies, a bottle is ready or a friend writes. It never shows what anyone wrote. Nothing between 10 PM and 9 AM.
      </p>
      {note && <p className="font-body text-sm mt-2" style={{ color: C.text }} role="status">{note}</p>}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button type="button" disabled={busy} className="rounded-lg px-5 min-h-[44px] font-body pp-focus text-[0.875rem] tracking-[0.22em] uppercase bg-[#C9A96E] text-[#13170F] disabled:opacity-60"
          onClick={async () => {
            setBusy(true);
            const r = await turnOn();
            setBusy(false);
            if (r.state === "on") { close("answered"); return; }
            if (r.state === "blocked") { setNote("Notifications are blocked for this site in your browser's settings."); markPromptDone("answered"); return; }
            setNote(r.error || "Notifications weren't turned on. You can turn them on any time in Account.");
          }}>
          {busy ? "Turning on…" : "Turn on"}
        </button>
        <button type="button" onClick={() => close("dismissed")} className="font-body text-[0.875rem] underline underline-offset-4 min-h-[44px] px-1 pp-focus" style={{ color: C.muted }}>Not now</button>
      </div>
    </section>
  );
}
