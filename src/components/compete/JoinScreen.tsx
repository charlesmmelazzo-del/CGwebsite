"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { formatEventDate } from "@/lib/compete/defaults";
import type { PublicEvent } from "@/lib/compete/types";
import { accentStyle, brandLogos, LogoLockup } from "./Profiles";

/** Sign in with the code printed on your ticket. A QR code pre-fills it. */
export default function JoinScreen({
  ev,
  initialCode,
  onSimJoin,
}: {
  ev: PublicEvent;
  initialCode?: string;
  /** Showcase mode: "joining" just moves the walkthrough on. */
  onSimJoin?: () => void;
}) {
  const [code, setCode] = useState((initialCode ?? "").toUpperCase());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function join(e: React.FormEvent) {
    e.preventDefault();
    if (onSimJoin) return onSimJoin();
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/compete/${ev.slug}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      // Drop ?code= so a refresh or a shared screenshot doesn't carry it.
      window.location.replace(`/compete/${ev.slug}`);
    } catch (err) {
      setError((err as Error).message || "That didn’t work. Please try again.");
      setBusy(false);
    }
  }

  return (
    <div className="cmp flex flex-col min-h-full" style={accentStyle(ev.accentColor)}>
      <div className="mx-auto w-full max-w-md flex-1 flex flex-col justify-center px-6 py-16 text-center">
        <LogoLockup cgLogo={ev.commonGoodLogo} brandLogos={brandLogos(ev.sponsors).slice(0, 1)} size="lg" />
        <div className="cmp-label mt-14">Common Good Presents</div>
        <h1 className="cmp-display text-5xl mt-4">{ev.name}</h1>
        {ev.featuredSpirit && <p className="mt-4 italic cmp-muted">featuring {ev.featuredSpirit}</p>}
        <p className="mt-6 text-xs tracking-[0.2em] uppercase cmp-faint">
          {formatEventDate(ev.eventDate)}
          {ev.startTime ? ` · ${ev.startTime}` : ""}
        </p>

        <form onSubmit={join} className="mt-14 text-left">
          <label htmlFor="code" className="cmp-label block text-center">
            Enter the code on your ticket
          </label>
          <input
            id="code"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8))}
            autoComplete="one-time-code"
            autoCapitalize="characters"
            spellCheck={false}
            inputMode="text"
            placeholder="ABC123"
            className="cmp-input mt-4 text-center !text-3xl tracking-[0.4em] cmp-display uppercase placeholder:text-[var(--cmp-faint)] placeholder:opacity-50"
          />
          {error && <p className="mt-3 text-sm text-center text-red-300">{error}</p>}
          <button type="submit" disabled={busy || code.length < 4} className="cmp-btn w-full mt-5">
            {busy && <Loader2 size={15} className="animate-spin" />} Join the Competition
          </button>
          <p className="mt-5 text-xs text-center cmp-faint leading-relaxed">
            Each code works on one phone. Need help? Ask any member of our staff.
          </p>
        </form>
      </div>
    </div>
  );
}
