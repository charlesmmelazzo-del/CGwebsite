"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { loadTale, type TaleCard, type TaleText } from "./tales";
import { readFont, voiceFont } from "./ui";

/** Reader text sizes, as multiples of 18px. */
export const TEXT_SCALES = [0.85, 1, 1.15, 1.3, 1.5, 1.75];

/**
 * The story, full screen: one long scroll in a plain book face, with the
 * controls a reader needs and nothing else — leave, text size, bookmark.
 *
 * Their place is saved as they scroll (and when they leave), as a fraction of
 * the way through, so changing the text size or coming back on a different
 * screen size still lands them in the same part of the story.
 */
export default function Reader({
  card,
  startAt,
  textScale,
  onTextScale,
  onProgress,
  onFinished,
  onExit,
}: {
  card: TaleCard;
  /** 0–1: where to open the story. */
  startAt: number;
  textScale: number;
  onTextScale: (scale: number) => void;
  /** Saves their place. Returns false if this browser couldn't save it. */
  onProgress: (progress: number) => boolean;
  onFinished: () => void;
  onExit: (progress: number, finished: boolean) => void;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  const end = useRef<HTMLDivElement>(null);
  const [text, setText] = useState<TaleText | null>(null);
  const [failed, setFailed] = useState(false);
  const [finished, setFinished] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const progress = useRef(startAt);
  const finishedRef = useRef(false);

  const load = useCallback(() => {
    setFailed(false);
    loadTale(card.id)
      .then(setText)
      .catch(() => setFailed(true));
  }, [card.id]);
  useEffect(load, [load]);

  const measure = () => {
    const el = scroller.current;
    if (!el) return progress.current;
    const room = el.scrollHeight - el.clientHeight;
    return room > 0 ? Math.min(1, Math.max(0, el.scrollTop / room)) : 0;
  };

  const jumpTo = (p: number) => {
    const el = scroller.current;
    if (el) el.scrollTop = p * (el.scrollHeight - el.clientHeight);
  };

  // Open at their bookmark once the text is on screen. A layout effect runs
  // after the text is laid out but before it's painted, so there's no flash
  // of the top — and unlike requestAnimationFrame it isn't paused in a tab
  // the browser has put in the background.
  useLayoutEffect(() => {
    if (text) jumpTo(progress.current);
    // Only when the text arrives; later size changes are handled below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text]);

  // A new text size reflows everything: hold their place through it.
  const scaleRef = useRef(textScale);
  useLayoutEffect(() => {
    if (scaleRef.current === textScale) return;
    scaleRef.current = textScale;
    jumpTo(progress.current);
  }, [textScale]);

  const finish = useCallback(() => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    setFinished(true);
    onFinished();
  }, [onFinished]);

  // Save their place as they scroll, a moment after they stop.
  useEffect(() => {
    const el = scroller.current;
    if (!el || !text) return;
    let t = 0;
    const onScroll = () => {
      progress.current = measure();
      // Scrolled to the bottom counts as finishing, even if the observer
      // below never fires (background tabs throttle it).
      if (progress.current > 0.995) finish();
      window.clearTimeout(t);
      t = window.setTimeout(() => onProgress(progress.current), 700);
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      el.removeEventListener("scroll", onScroll);
      window.clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, onProgress, finish]);

  // Reaching "The End" counts as finishing the tale.
  useEffect(() => {
    const el = end.current;
    if (!el || !text || finished) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) finish();
      },
      { root: scroller.current, threshold: 0.6 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [text, finished, finish]);

  // Escape leaves, as the Exit button does.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onExit(measure(), finished);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finished, onExit]);

  function bookmark() {
    progress.current = measure();
    setNotice(onProgress(progress.current) ? "Place saved" : "This browser couldn't save your place");
    window.setTimeout(() => setNotice(null), 2200);
  }

  const step = TEXT_SCALES.indexOf(textScale);
  const size = (d: number) => {
    const next = TEXT_SCALES[Math.min(TEXT_SCALES.length - 1, Math.max(0, (step < 0 ? 1 : step) + d))];
    progress.current = measure();
    onTextScale(next);
  };

  const control = `${voiceFont.className} min-h-[44px] min-w-[44px] px-2.5 rounded-[6px] border-2 border-white/40 text-white text-[15px]
    focus:outline-none focus-visible:border-white [@media(hover:hover)]:hover:border-white disabled:opacity-30`;

  return (
    <div className="fixed inset-0 z-[70] bg-black text-white flex flex-col" role="dialog" aria-modal="true" aria-label={card.title}>
      <header className="shrink-0 border-b-2 border-white/25 px-3 py-2 flex items-center gap-2">
        <button type="button" className={control} onClick={() => onExit(measure(), finished)}>
          Exit
        </button>
        <p className={`${voiceFont.className} flex-1 min-w-0 truncate text-center text-[15px] text-white/80`}>{card.title}</p>
        <button type="button" className={control} onClick={() => size(-1)} disabled={step === 0} aria-label="Smaller text">
          A−
        </button>
        <button
          type="button"
          className={control}
          onClick={() => size(1)}
          disabled={step === TEXT_SCALES.length - 1}
          aria-label="Bigger text"
        >
          A+
        </button>
        <button type="button" className={control} onClick={bookmark} aria-label="Bookmark my place">
          <svg viewBox="0 0 12 14" className="w-4 h-4 mx-auto" shapeRendering="crispEdges" aria-hidden>
            <path d="M1 0h10v14l-5-4-5 4z" fill="#fff" />
          </svg>
        </button>
      </header>

      <p aria-live="polite" className="sr-only">
        {notice ?? ""}
      </p>
      {notice && (
        <p
          className={`${voiceFont.className} absolute top-[64px] left-1/2 -translate-x-1/2 z-10 bg-white text-black px-3 py-1.5 rounded-[6px] text-[14px]`}
        >
          {notice}
        </p>
      )}

      <div ref={scroller} className="flex-1 overflow-y-auto overscroll-contain">
        <article
          className={`${readFont.className} mx-auto max-w-[640px] px-5 pt-8 pb-24`}
          style={{ fontSize: `${18 * textScale}px`, lineHeight: 1.7 }}
        >
          <h1 className={`${voiceFont.className} text-[1.6em] leading-tight`}>{card.title}</h1>
          <p className="mt-1 text-[0.85em] text-white/60">
            {card.author}
            {card.year ? `, ${card.year}` : ""}
          </p>
          <p className={`${voiceFont.className} mt-6 text-[0.9em] text-white/70 border-l-2 border-white/40 pl-3`}>
            &ldquo;{card.host.bridge}&rdquo;
          </p>

          {!text && !failed && <p className="mt-10 text-white/50">Fetching the tale…</p>}
          {failed && (
            <div className="mt-10 space-y-4">
              <p className="text-white/80">The story couldn&apos;t be loaded. Check your connection and try again.</p>
              <button type="button" className={control} onClick={load}>
                Try again
              </button>
            </div>
          )}

          {text && (
            <>
              <div className="mt-8 space-y-[1em]">
                {text.paragraphs.map((p, i) => (
                  <p key={i} className="whitespace-pre-line">
                    {p}
                  </p>
                ))}
              </div>
              <div ref={end} className="mt-14 text-center">
                <p className={`${voiceFont.className} text-[1.3em] tracking-[0.2em]`}>THE END</p>
                <button
                  type="button"
                  className={`${control} mt-8 px-5`}
                  onClick={() => {
                    finish();
                    onExit(1, true);
                  }}
                >
                  Back to the bar
                </button>
                <p className="mt-10 text-[0.75em] text-white/40">
                  Public-domain text.{" "}
                  <a href={card.sourceUrl} target="_blank" rel="noreferrer" className="underline">
                    Source
                  </a>
                </p>
              </div>
            </>
          )}
        </article>
      </div>
    </div>
  );
}
