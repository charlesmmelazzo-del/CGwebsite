"use client";

// Cocktail competitions on the Events page: a feature card for each upcoming
// or live competition, and the Past Competitions archive.

import Link from "next/link";
import { ArrowRight, Trophy } from "lucide-react";

export type CurrentCompetition = {
  slug: string;
  name: string;
  featuredSpirit: string;
  eventDate: string | null;
  startTime: string;
  status: string;
  accentColor: string;
  logoUrl?: string;
};

export type PastCompetition = {
  slug: string;
  name: string;
  featuredSpirit: string;
  eventDate: string | null;
  accentColor: string;
  logoUrl?: string;
  winner?: string;
};

function fmt(d: string | null) {
  if (!d) return "";
  return new Date(`${d}T12:00:00`).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
}

function isToday(d: string | null) {
  if (!d) return false;
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Chicago" });
  return d === today;
}

export function CurrentCompetitions({ items }: { items: CurrentCompetition[] }) {
  if (items.length === 0) return null;
  return (
    <div className="px-4 md:px-0 mb-8 space-y-4">
      {items.map((c) => {
        const live = c.status === "live" || isToday(c.eventDate);
        return (
          <Link
            key={c.slug}
            href={`/compete/${c.slug}`}
            className="group block bg-[#12110e] text-[#f2ede3] p-6 md:p-8 border border-white/10 hover:border-white/25 transition-colors"
          >
            <div className="flex items-center justify-between gap-4">
              <span className="text-[11px] tracking-[0.22em] uppercase" style={{ color: c.accentColor }}>
                {live ? "● Live Competition" : "Cocktail Competition"}
              </span>
              {c.logoUrl && <img src={c.logoUrl} alt="" className="h-7 w-auto object-contain opacity-90" />}
            </div>
            <h3 className="mt-4 text-3xl md:text-4xl tracking-wide" style={{ fontFamily: "var(--font-display)" }}>
              {c.name}
            </h3>
            {c.featuredSpirit && <p className="mt-2 italic text-[#a8a196]">featuring {c.featuredSpirit}</p>}
            <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
              <span className="text-xs tracking-[0.18em] uppercase text-[#a8a196]">
                {fmt(c.eventDate)}
                {c.startTime ? ` · ${c.startTime}` : ""}
              </span>
              <span className="inline-flex items-center gap-2 text-xs tracking-[0.2em] uppercase" style={{ color: c.accentColor }}>
                {live ? "Join with your ticket" : "Ticket holders: sign in"} <ArrowRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
              </span>
            </div>
          </Link>
        );
      })}
    </div>
  );
}

export function PastCompetitions({ items, theme }: { items: PastCompetition[]; theme: { text: string; muted: string } }) {
  return (
    <div className="max-w-2xl mx-auto px-4 md:px-0" style={{ borderTop: `1px solid ${theme.muted}20` }}>
      {items.map((c) => (
        <Link
          key={c.slug}
          href={`/compete/${c.slug}`}
          className="flex items-center gap-5 px-4 md:px-8 py-6 group"
          style={{ borderBottom: `1px solid ${theme.muted}20` }}
        >
          <Trophy size={20} strokeWidth={1.3} style={{ color: c.accentColor }} className="shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="text-xl tracking-wide" style={{ fontFamily: "var(--font-display)", color: theme.text }}>
              {c.name}
            </div>
            <div className="mt-1 text-xs tracking-wider uppercase opacity-60">
              {fmt(c.eventDate)}
              {c.featuredSpirit ? ` · ${c.featuredSpirit}` : ""}
            </div>
            {c.winner && <div className="mt-1.5 text-sm opacity-80">Winner: {c.winner}</div>}
          </div>
          <ArrowRight size={16} className="opacity-50 group-hover:opacity-100 transition-opacity" />
        </Link>
      ))}
    </div>
  );
}
