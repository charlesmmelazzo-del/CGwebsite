"use client";

// ─── After hanging an ornament ───────────────────────────────────────────────
// The ornament rises off the tree and becomes a star, then the code and what
// happens next. A held pledge gets exactly this screen too (5.2).

import { motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { COPY } from "@/lib/givingTree/copy";
import { longDate } from "@/lib/givingTree/format";
import type { ClaimSuccess } from "./ClaimForm";
import { riseTransition, riseVariants, useReducedMotion } from "./motion";

export default function Success({ s, onSky, onClose }: { s: ClaimSuccess; onSky: () => void; onClose: () => void }) {
  const reduced = useReducedMotion();
  const [risen, setRisen] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (risen) heading.current?.focus();
  }, [risen]);

  return (
    <div className="gt-overlay">
      {!risen && (
        <motion.div
          aria-hidden="true"
          className="gt-ornament !static !transform-none"
          data-zone={s.opportunity.zone}
          style={{ width: 140, height: 140, fontSize: 15 }}
          variants={riseVariants(reduced)}
          initial="start"
          animate="end"
          transition={riseTransition(reduced)}
          onAnimationComplete={() => setRisen(true)}
        >
          <span className="gt-ornament-title">{s.opportunity.title}</span>
        </motion.div>
      )}
      {risen && (
        <div role="dialog" aria-modal="true" aria-labelledby="gt-success-title" className="gt-dialog gt-card p-5 space-y-3">
          <div className="flex justify-center" aria-hidden="true">
            <span className="gt-star-dot" style={{ width: 22, height: 22 }} />
          </div>
          <h2 id="gt-success-title" ref={heading} tabIndex={-1} className="gt-display text-[length:var(--gt-size-xl)] text-center">
            {COPY.successTitle}
          </h2>

          {s.type === "gift" ? (
            <>
              <p className="rounded-lg p-3 bg-black/5 text-[length:var(--gt-size-l)] font-semibold">{COPY.giftCodeFirst(s.code)}</p>
              {s.dropoff && <p>{s.dropoff}</p>}
              {s.dueDate && <p>{COPY.giftDue(longDate(s.dueDate))}</p>}
            </>
          ) : (
            <p className="text-center">
              {COPY.codeLabel}: <span className="font-mono text-[length:var(--gt-size-l)] font-semibold tracking-widest">{s.code}</span>
            </p>
          )}
          {s.type === "volunteer" && <p>{COPY.volunteerNext(s.orgName)}</p>}
          {s.type === "cash" && s.giveUrl && (
            <a className="gt-btn gt-btn-primary w-full" href={s.giveUrl} target="_blank" rel="noopener noreferrer">
              {COPY.cashContinue(s.orgName)}
            </a>
          )}
          <p className="gt-small gt-muted">{COPY.emailSent}</p>
          <div className="flex gap-2">
            <button type="button" className={`gt-btn flex-1 ${s.type === "cash" ? "" : "gt-btn-primary"}`} onClick={onSky}>
              {COPY.seeYourStar}
            </button>
            <button type="button" className="gt-btn flex-1" onClick={onClose}>
              {COPY.backToTree}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
