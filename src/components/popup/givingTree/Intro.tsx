"use client";

// ─── The opening: three panels written out in script ─────────────────────────
//
// Each panel fills in letter by letter, as if someone were writing it, then
// waits a moment and moves on. A tap finishes the panel being written, or
// moves to the next one once it's done. "Skip" goes straight to the home
// screen. With reduced motion on, each panel simply appears.

import localFont from "next/font/local";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { COPY } from "@/lib/givingTree/copy";
import { useReducedMotion } from "./motion";

// Dancing Script (SIL Open Font License, see fonts/OFL.txt), kept in the repo
// rather than fetched from Google Fonts at build time, which fails at random.
export const scriptFont = localFont({
  src: [
    { path: "./fonts/dancing-script-latin-400-normal.woff2", weight: "400", style: "normal" },
    { path: "./fonts/dancing-script-latin-600-normal.woff2", weight: "600", style: "normal" },
  ],
  display: "swap",
  fallback: ["cursive"],
});

/** Milliseconds between letters, and the pause once a panel is finished. */
const LETTER_MS = 38;
const HOLD_MS = 4500;

function Written({ text, instant }: { text: string; instant: boolean }) {
  // Words stay whole so a line never breaks mid-word while it's being written.
  const words = useMemo(() => {
    let i = 0;
    return text.split(" ").map((w) => {
      const start = i;
      i += w.length + 1;
      return { w, start };
    });
  }, [text]);
  return (
    <p aria-hidden="true" className="gt-written">
      {words.map(({ w, start }, wi) => (
        <span key={wi} className="inline-block whitespace-nowrap">
          {Array.from(w).map((ch, ci) => (
            <span key={ci} className="gt-ink" style={instant ? { animation: "none", opacity: 1 } : { animationDelay: `${(start + ci) * LETTER_MS}ms` }}>
              {ch}
            </span>
          ))}
          {wi < words.length - 1 && " "}
        </span>
      ))}
    </p>
  );
}

export default function Intro({ onDone }: { onDone: () => void }) {
  const reduced = useReducedMotion();
  const panels = COPY.introPanels;
  const [i, setI] = useState(0);
  const [finished, setFinished] = useState(false);
  const text = panels[i];
  const writeMs = text.length * LETTER_MS + 600;

  // Mark the panel finished once the last letter is in, then move on.
  useEffect(() => {
    setFinished(reduced);
    if (reduced) return;
    const t = window.setTimeout(() => setFinished(true), writeMs);
    return () => window.clearTimeout(t);
  }, [i, reduced, writeMs]);

  useEffect(() => {
    if (!finished || reduced) return;
    const t = window.setTimeout(next, HOLD_MS);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finished, reduced, i]);

  function next() {
    if (i < panels.length - 1) setI(i + 1);
    else onDone();
  }

  function tap() {
    if (!finished) setFinished(true);
    else next();
  }

  return (
    <div className={`gt-intro ${scriptFont.className}`} onClick={tap} role="presentation">
      <button
        type="button"
        className="absolute top-3 right-3 gt-btn gt-btn-small gt-intro-skip"
        onClick={(e) => {
          e.stopPropagation();
          onDone();
        }}
      >
        {COPY.introSkip}
      </button>

      <AnimatePresence mode="wait">
        <motion.div
          key={i}
          className="gt-intro-panel"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduced ? 0.2 : 0.8 }}
        >
          <p className="sr-only" aria-live="polite">
            {text}
          </p>
          <Written text={text} instant={finished} />
        </motion.div>
      </AnimatePresence>

      <div className="absolute bottom-6 inset-x-0 flex flex-col items-center gap-3" aria-hidden="true">
        <div className="flex gap-2">
          {panels.map((_, n) => (
            <span key={n} className="gt-intro-dot" data-on={n === i ? "true" : "false"} />
          ))}
        </div>
        <span className="gt-intro-hint" style={{ opacity: finished ? 0.75 : 0 }}>
          {COPY.introContinue}
        </span>
      </div>
    </div>
  );
}
