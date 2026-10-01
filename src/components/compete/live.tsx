"use client";

// Live sync and the pieces of the show shared by phones and the big screen.

import { useCallback, useEffect, useRef, useState } from "react";
import { Star } from "lucide-react";
import type { LiveState, PublicContestant, PublicEvent, ScoreCategory } from "@/lib/compete/types";
import { bartenderBar, bartenderName, cocktailName, Monogram, CocktailPlaceholder } from "./Profiles";

const POLL_MS = 1500;

/**
 * Follows the host. Polls the tiny live-state endpoint and re-polls the
 * moment a phone wakes up, so a guest who locked their screen during a
 * presentation lands on the right page when they look again.
 */
export function useLive(slug: string, initial: { version: number; state: LiveState; status: string }) {
  const [live, setLive] = useState(initial);
  const versionRef = useRef(initial.version);

  const poll = useCallback(async () => {
    try {
      const res = await fetch(`/api/compete/${slug}/live`, { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      if (data.version !== versionRef.current) {
        versionRef.current = data.version;
        setLive({ version: data.version, state: data.state, status: data.status });
      }
    } catch {
      // Offline for a moment — the next tick tries again.
    }
  }, [slug]);

  useEffect(() => {
    const t = setInterval(() => {
      if (document.visibilityState === "visible") poll();
    }, POLL_MS);
    const wake = () => document.visibilityState === "visible" && poll();
    document.addEventListener("visibilitychange", wake);
    window.addEventListener("focus", wake);
    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", wake);
      window.removeEventListener("focus", wake);
    };
  }, [poll]);

  return { ...live, refresh: poll };
}

// ─── Stars ───────────────────────────────────────────────────────────────────

export function StarRow({
  value,
  onChange,
  size = 32,
  disabled,
  label,
}: {
  value: number;
  onChange?: (v: number) => void;
  size?: number;
  disabled?: boolean;
  label?: string;
}) {
  return (
    <div className="flex items-center gap-1" role={onChange ? "radiogroup" : undefined} aria-label={label}>
      {[1, 2, 3, 4, 5].map((n) => {
        const on = n <= value;
        const icon = (
          <Star
            width={size}
            height={size}
            strokeWidth={1.2}
            className="transition-colors"
            style={{
              color: on ? "var(--cmp-accent)" : "var(--cmp-faint)",
              fill: on ? "var(--cmp-accent)" : "transparent",
            }}
          />
        );
        return onChange ? (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={value === n}
            aria-label={`${n} star${n > 1 ? "s" : ""}`}
            disabled={disabled}
            onClick={() => onChange(n)}
            className="p-1 -m-0.5 active:scale-90 transition-transform disabled:opacity-50"
          >
            {icon}
          </button>
        ) : (
          <span key={n}>{icon}</span>
        );
      })}
    </div>
  );
}

// ─── Judges' reveal ──────────────────────────────────────────────────────────

export function JudgeReveal({
  judges,
  categories,
  big,
}: {
  judges: { name: string; scores: Record<string, number> }[];
  categories: ScoreCategory[];
  big?: boolean;
}) {
  if (judges.length === 0) {
    return <p className="cmp-muted text-sm text-center">No judges’ scores yet.</p>;
  }
  return (
    <div className={big ? "grid gap-6" : "space-y-3"} style={big ? { gridTemplateColumns: `repeat(${Math.min(judges.length, 4)}, minmax(0, 1fr))` } : undefined}>
      {judges.map((j, i) => (
        <div key={i} className="cmp-card p-4 cmp-rise" style={{ animationDelay: `${i * 450}ms` }}>
          <div className={`cmp-display ${big ? "text-4xl mb-5" : "text-2xl mb-3"}`}>{j.name}</div>
          <div className={big ? "space-y-3" : "space-y-2"}>
            {categories.map((c) => (
              <div key={c.id} className="flex items-center justify-between gap-3">
                <span className={`${big ? "text-lg" : "text-xs"} tracking-[0.16em] uppercase cmp-muted`}>{c.label}</span>
                <StarRow value={j.scores[c.id] ?? 0} size={big ? 26 : 16} />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Winners ─────────────────────────────────────────────────────────────────

export function WinnerCard({
  ev,
  label,
  contestant,
  fresh,
  big,
}: {
  ev: PublicEvent;
  label: string;
  contestant?: PublicContestant;
  fresh?: boolean;
  big?: boolean;
}) {
  const name = contestant ? bartenderName(ev.bartenderFields, contestant.bartender) : "";
  const bar = contestant ? bartenderBar(ev.bartenderFields, contestant.bartender) : "";
  const drink = contestant ? cocktailName(ev.cocktailFields, contestant.cocktail) : "";
  const photo = contestant?.bartender.photoUrl || contestant?.cocktail.photoUrl;
  return (
    <div className={`cmp-card ${fresh ? "cmp-rise" : ""} ${big ? "p-10" : "p-5"} text-center`} style={fresh ? { borderColor: "var(--cmp-accent)" } : undefined}>
      <div className="cmp-label">{label}</div>
      {contestant ? (
        <>
          <div className={`mx-auto ${big ? "mt-8 w-56 h-56" : "mt-5 w-24 h-24"} rounded-full overflow-hidden`}>
            {photo ? (
              <img src={photo} alt="" className="w-full h-full object-cover" />
            ) : contestant.bartender.name ? (
              <Monogram name={name} className="w-full h-full rounded-full" />
            ) : (
              <CocktailPlaceholder className="w-full h-full rounded-full" />
            )}
          </div>
          <div className={`cmp-display ${big ? "text-7xl mt-8" : "text-3xl mt-4"}`}>{name}</div>
          {bar && <div className={`${big ? "text-2xl mt-3" : "text-xs mt-1"} tracking-[0.18em] uppercase cmp-muted`}>{bar}</div>}
          <div className={`${big ? "text-3xl mt-6" : "text-base mt-3"} italic cmp-muted`}>“{drink}”</div>
        </>
      ) : (
        <p className="mt-3 cmp-faint text-sm">No votes in this category.</p>
      )}
    </div>
  );
}
