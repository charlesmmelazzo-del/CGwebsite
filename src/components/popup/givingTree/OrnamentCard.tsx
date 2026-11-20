"use client";

// ─── An ornament, turned over ────────────────────────────────────────────────
// Front: the title. Back: who it's for, the details, spots or the meter, the
// countdown, and "Hang my ornament", which opens the claim form in place.

import { motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { COPY } from "@/lib/givingTree/copy";
import { whenLine } from "@/lib/givingTree/format";
import { daysBetween } from "@/lib/givingTree/time";
import type { PublicOpportunity, PublicOrg } from "@/lib/givingTree/types";
import ClaimForm, { type ClaimSuccess } from "./ClaimForm";
import { flipTransition, flipVariants, useReducedMotion } from "./motion";

export function Meter({ o }: { o: PublicOpportunity }) {
  if (o.type !== "cash" || o.meterValue == null) return null;
  const pct = o.goalAmount ? Math.min(100, (o.meterValue / o.goalAmount) * 100) : 0;
  return (
    <div>
      <div className="gt-meter" role="img" aria-label={COPY.meter(o.meterValue, o.goalAmount, o.meterLabel ?? "pledged", o.meterAsOf)}>
        <span style={{ width: `${pct}%` }} />
      </div>
      <p className="gt-small mt-1">{COPY.meter(o.meterValue, o.goalAmount, o.meterLabel ?? "pledged", o.meterAsOf)}</p>
    </div>
  );
}

export function Logo({ org, size = 44 }: { org: PublicOrg; size?: number }) {
  if (org.logoUrl) {
    // eslint-disable-next-line @next/next/no-img-element -- admin-uploaded logo
    return <img src={org.logoUrl} alt="" width={size} height={size} className="rounded-full object-contain bg-white shrink-0" style={{ width: size, height: size }} />;
  }
  return (
    <span aria-hidden="true" className="shrink-0 rounded-full bg-black/10 flex items-center justify-center font-semibold gt-display" style={{ width: size, height: size, fontSize: size * 0.42 }}>
      {org.name.slice(0, 1)}
    </span>
  );
}

export default function OrnamentCard({
  o,
  org,
  today,
  sandbox,
  contactEmail,
  onClose,
  onOrg,
  onSuccess,
}: {
  o: PublicOpportunity;
  org: PublicOrg;
  today: string;
  sandbox: boolean;
  contactEmail: string;
  onClose: () => void;
  onOrg: (orgId: string) => void;
  onSuccess: (s: ClaimSuccess) => void;
}) {
  const reduced = useReducedMotion();
  const [side, setSide] = useState<"front" | "back">("front");
  const [claiming, setClaiming] = useState(false);
  const closeBtn = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeBtn.current?.focus();
    const t = window.setTimeout(() => setSide("back"), reduced ? 0 : 350);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose, reduced]);

  const days = o.deadline ? daysBetween(today, o.deadline) : null;
  const when = whenLine(o);
  const hours = o.type === "volunteer" ? (o.hoursMode === "choose" && o.hoursMin != null && o.hoursMax != null ? COPY.hoursChoose(o.hoursMin, o.hoursMax) : o.hoursFixed ? COPY.hoursFixed(o.hoursFixed) : null) : null;

  return (
    <div className="gt-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" aria-label={o.title} className="gt-dialog" style={{ perspective: 1200 }}>
        {claiming ? (
          <div className="gt-card p-4">
            <ClaimForm o={o} org={org} sandbox={sandbox} contactEmail={contactEmail} onCancel={() => setClaiming(false)} onSuccess={onSuccess} />
          </div>
        ) : (
          <motion.div
            className="relative"
            style={{ transformStyle: "preserve-3d" }}
            variants={flipVariants(reduced)}
            initial="enter"
            animate={side}
            transition={flipTransition}
          >
            {/* Front */}
            <div className="gt-card p-6 text-center absolute inset-0 flex items-center justify-center" style={{ backfaceVisibility: "hidden", visibility: side === "front" ? "visible" : "hidden" }} aria-hidden={side !== "front"}>
              <p className="gt-display text-[var(--gt-size-xl)]">{o.title}</p>
            </div>
            {/* Back */}
            <div className="gt-card p-4" style={{ backfaceVisibility: "hidden", transform: reduced ? undefined : "rotateY(180deg)" }}>
              <div className="flex items-start justify-between gap-2">
                <button type="button" className="flex items-center gap-2 text-left underline-offset-2 hover:underline" onClick={() => onOrg(org.id)}>
                  <Logo org={org} size={36} />
                  <span className="font-semibold">{org.name}</span>
                </button>
                <button ref={closeBtn} type="button" className="gt-btn gt-btn-small" onClick={onClose}>
                  {COPY.close}
                </button>
              </div>
              <h2 className="gt-display text-[var(--gt-size-xl)] mt-3 leading-tight">{o.title}</h2>
              {o.description && <p className="mt-2 whitespace-pre-line">{o.description}</p>}
              <ul className="mt-3 space-y-1 gt-small">
                {when && <li>{when}</li>}
                {hours && <li>{hours}</li>}
                {o.type !== "cash" && o.spots > 1 && <li>{COPY.spotsLeft(o.spotsLeft, o.spots)}</li>}
                {days != null && days >= 0 && <li className="font-semibold">{COPY.countdown(days, o.type)}</li>}
              </ul>
              {o.type === "cash" && (
                <div className="mt-3">
                  <Meter o={o} />
                </div>
              )}
              <button type="button" className="gt-btn gt-btn-primary w-full mt-4" onClick={() => setClaiming(true)}>
                {COPY.hangButton}
              </button>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
