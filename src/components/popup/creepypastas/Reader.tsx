"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { loadTale, type TaleCard, type TaleText, type TaleVersion } from "./tales";
import { readFont, voiceFont } from "./ui";

/** Reader text sizes, as multiples of 18px. */
export const TEXT_SCALES = [0.85, 1, 1.15, 1.3, 1.5, 1.75];

/** Where a reader is: how far through, and the paragraph at the top of the screen. */
export interface Place {
  progress: number;
  para: number;
}

/**
 * The story, full screen: one long scroll in a plain book face, with the
 * controls a reader needs and nothing else — leave, text size, bookmark, and
 * (for tales that have one) a switch between the author's words and the
 * modern English retelling.
 *
 * Their place is kept as a PARAGRAPH: both tellings have the same paragraphs
 * in the same order, so switching versions, changing the text size or coming
 * back on a different phone all land on the same part of the story.
 */
export default function Reader({
  card,
  version,
  onVersion,
  startAt,
  startPara,
  modernBridge,
  textScale,
  onTextScale,
  onProgress,
  onFinished,
  onExit,
}: {
  card: TaleCard;
  version: TaleVersion;
  onVersion: (v: TaleVersion) => void;
  /** 0–1: where to open the story, when there's no paragraph to go by. */
  startAt: number;
  /** The paragraph to open at, from a bookmark. */
  startPara?: number;
  /** What he says before the modern telling, instead of the word-for-word bridge. */
  modernBridge: string;
  textScale: number;
  onTextScale: (scale: number) => void;
  /** Saves their place. Returns false if this browser couldn't save it. */
  onProgress: (place: Place) => boolean;
  onFinished: () => void;
  onExit: (place: Place, finished: boolean) => void;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  const end = useRef<HTMLDivElement>(null);
  const [texts, setTexts] = useState<Partial<Record<TaleVersion, TaleText>>>({});
  const [failed, setFailed] = useState(false);
  const [finished, setFinished] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const place = useRef<Place>({ progress: startAt, para: startPara ?? -1 });
  /** Where to put them once the text in front of them has been laid out. */
  const restore = useRef<{ para: number; frac: number } | null>(
    startPara !== undefined && startPara >= 0 ? { para: startPara, frac: 0 } : null
  );
  const finishedRef = useRef(false);
  /** The reader has scrolled, tapped or typed since we last placed them. */
  const touched = useRef(false);
  const text = texts[version] ?? null;

  const load = useCallback(() => {
    if (texts[version]) return;
    setFailed(false);
    loadTale(card.id, version)
      // A second copy arriving (a repeated request) must not count as new text.
      .then((t) => setTexts((prev) => (prev[version] ? prev : { ...prev, [version]: t })))
      .catch(() => setFailed(true));
  }, [card.id, version, texts]);
  useEffect(load, [load]);

  /** The paragraph at the top of the screen, and how far into it they are. */
  const topParagraph = (): { para: number; frac: number } | null => {
    const sc = scroller.current;
    if (!sc) return null;
    const top = sc.getBoundingClientRect().top;
    const paras = sc.querySelectorAll<HTMLElement>("[data-p]");
    for (const el of Array.from(paras)) {
      const r = el.getBoundingClientRect();
      if (r.bottom > top + 2) {
        return { para: Number(el.dataset.p), frac: Math.min(1, Math.max(0, (top - r.top) / Math.max(1, r.height))) };
      }
    }
    return null;
  };

  const measure = (): Place => {
    const el = scroller.current;
    if (!el) return place.current;
    const room = el.scrollHeight - el.clientHeight;
    const progress = room > 0 ? Math.min(1, Math.max(0, el.scrollTop / room)) : 0;
    return { progress, para: topParagraph()?.para ?? place.current.para };
  };

  const jumpToParagraph = (para: number, frac: number) => {
    const sc = scroller.current;
    const el = sc?.querySelector<HTMLElement>(`[data-p="${para}"]`);
    if (!sc || !el) return false;
    sc.scrollTop += el.getBoundingClientRect().top - sc.getBoundingClientRect().top + frac * el.offsetHeight;
    return true;
  };

  const jumpToProgress = (p: number) => {
    const el = scroller.current;
    if (el) el.scrollTop = p * (el.scrollHeight - el.clientHeight);
  };

  // Put them back in place whenever the text in front of them changes — first
  // load, a bookmark, or a switch of telling. A layout effect runs after the
  // text is laid out but before it's painted, so there's no flash of the top,
  // and unlike requestAnimationFrame it isn't paused in a background tab.
  const restoredFor = useRef<{ version: TaleVersion; target: { para: number; frac: number } | null } | null>(null);
  useLayoutEffect(() => {
    if (!text) return;
    // Running again for the same telling (React may re-run effects) must land
    // in the same place, so remember the target rather than using it up.
    const target = restore.current ?? (restoredFor.current?.version === version ? restoredFor.current.target : null);
    restore.current = null;
    restoredFor.current = { version, target };
    const progress = place.current.progress;
    const go = () => {
      if (!(target && jumpToParagraph(target.para, target.frac))) jumpToProgress(progress);
    };
    go();
    // The book face loading in, or the screen's fade-in finishing, reflows the
    // text after that first jump. Land again once they've settled — unless
    // the reader has already started moving.
    touched.current = false;
    const again = () => {
      if (!touched.current) go();
    };
    void document.fonts?.ready.then(again);
    const t1 = window.setTimeout(again, 500);
    const t2 = window.setTimeout(again, 1200);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
    // Only when the text changes; size changes are handled below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text]);

  // A new text size reflows everything: hold their paragraph through it.
  const scaleRef = useRef(textScale);
  const scaleAnchor = useRef<{ para: number; frac: number } | null>(null);
  useLayoutEffect(() => {
    if (scaleRef.current === textScale) return;
    scaleRef.current = textScale;
    const a = scaleAnchor.current;
    scaleAnchor.current = null;
    if (!(a && jumpToParagraph(a.para, a.frac))) jumpToProgress(place.current.progress);
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
      place.current = measure();
      // Scrolled to the bottom counts as finishing, even if the observer
      // below never fires (background tabs throttle it).
      if (place.current.progress > 0.995) finish();
      window.clearTimeout(t);
      t = window.setTimeout(() => onProgress(place.current), 700);
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
    place.current = measure();
    setNotice(onProgress(place.current) ? "Place saved" : "This browser couldn't save your place");
    window.setTimeout(() => setNotice(null), 2200);
  }

  function switchTo(v: TaleVersion) {
    if (v === version) return;
    restore.current = topParagraph();
    place.current = measure();
    onVersion(v);
  }

  const step = TEXT_SCALES.indexOf(textScale);
  const size = (d: number) => {
    const next = TEXT_SCALES[Math.min(TEXT_SCALES.length - 1, Math.max(0, (step < 0 ? 1 : step) + d))];
    scaleAnchor.current = topParagraph();
    place.current = measure();
    onTextScale(next);
  };

  const control = `${voiceFont.className} min-h-[44px] min-w-[44px] px-2.5 rounded-[6px] border-2 border-white/40 text-white text-[15px]
    focus:outline-none focus-visible:border-white [@media(hover:hover)]:hover:border-white disabled:opacity-30`;
  const tab = (active: boolean) =>
    `${voiceFont.className} flex-1 min-h-[40px] px-2 text-[14px] rounded-[5px] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70 ${
      active ? "bg-white text-black" : "text-white/70 [@media(hover:hover)]:hover:text-white"
    }`;

  return (
    <div className="fixed inset-0 z-[70] bg-black text-white flex flex-col" role="dialog" aria-modal="true" aria-label={card.title}>
      <header className="shrink-0 border-b-2 border-white/25 px-3 py-2">
        <div className="flex items-center gap-2">
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
        </div>

        {card.modern && (
          <div
            role="group"
            aria-label="Which telling"
            className="mt-2 flex gap-1 p-1 border-2 border-white/30 rounded-[8px]"
          >
            <button type="button" aria-pressed={version === "original"} className={tab(version === "original")} onClick={() => switchTo("original")}>
              Original words
            </button>
            <button type="button" aria-pressed={version === "modern"} className={tab(version === "modern")} onClick={() => switchTo("modern")}>
              Modern English
            </button>
          </div>
        )}
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

      <div
        ref={scroller}
        className="flex-1 overflow-y-auto overscroll-contain"
        onWheel={() => (touched.current = true)}
        onTouchStart={() => (touched.current = true)}
        onPointerDown={() => (touched.current = true)}
        onKeyDown={() => (touched.current = true)}
      >
        <article
          className={`${readFont.className} mx-auto max-w-[640px] px-5 pt-8 pb-24`}
          style={{ fontSize: `${18 * textScale}px`, lineHeight: 1.7 }}
          lang="en"
        >
          <h1 className={`${voiceFont.className} text-[1.6em] leading-tight`}>{card.title}</h1>
          <p className="mt-1 text-[0.85em] text-white/60">
            {card.author}
            {card.year ? `, ${card.year}` : ""}
            {version === "modern" ? " · retold in modern English" : ""}
          </p>
          <p className={`${voiceFont.className} mt-6 text-[0.9em] text-white/70 border-l-2 border-white/40 pl-3`}>
            &ldquo;{version === "modern" ? modernBridge : card.host.bridge}&rdquo;
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
                  <p key={i} data-p={i} className="whitespace-pre-line">
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
                    onExit({ progress: 1, para: text.paragraphs.length - 1 }, true);
                  }}
                >
                  Back to the bar
                </button>
                <p className="mt-10 text-[0.75em] text-white/40">
                  Public-domain text
                  {version === "modern" ? ", retold in modern English for Common Good" : ""}.{" "}
                  <a href={card.sourceUrl} target="_blank" rel="noreferrer" className="underline">
                    Original source
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
