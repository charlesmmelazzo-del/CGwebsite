"use client";

// ─── Our Partners (3.7) ──────────────────────────────────────────────────────
// Public contact fields only, each shown only when filled in. Works whether
// or not an organization has anything left on the tree.

import { useEffect, useRef } from "react";
import { COPY } from "@/lib/givingTree/copy";
import type { PublicOrg } from "@/lib/givingTree/types";
import { Logo } from "./OrnamentCard";

function telHref(phone: string) {
  return `tel:${phone.replace(/[^\d+]/g, "")}`;
}

function socialName(url: string): string {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    return host.split(".")[0].replace(/^./, (c) => c.toUpperCase());
  } catch {
    return url;
  }
}

export function PartnerCard({ org, focused, onWaysToGive, hasOpen }: { org: PublicOrg; focused?: boolean; onWaysToGive?: () => void; hasOpen?: boolean }) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    if (focused && ref.current) {
      ref.current.scrollIntoView({ block: "start", behavior: "smooth" });
      ref.current.focus();
    }
  }, [focused]);
  return (
    <article ref={ref} tabIndex={-1} id={`partner-${org.slug}`} className={`gt-card p-4 space-y-3 ${focused ? "ring-4 ring-[var(--gt-accent)]" : ""}`}>
      <div className="flex items-center gap-3">
        <Logo org={org} size={52} />
        <h2 className="gt-display text-[var(--gt-size-l)] leading-tight">{org.name}</h2>
      </div>
      {org.description && <p className="whitespace-pre-line">{org.description}</p>}
      <ul className="flex flex-wrap gap-2">
        {org.website && (
          <li>
            <a className="gt-btn gt-btn-small" href={org.website} target="_blank" rel="noopener noreferrer">{COPY.website}</a>
          </li>
        )}
        {org.phone && (
          <li>
            <a className="gt-btn gt-btn-small" href={telHref(org.phone)}>{COPY.call} {org.phone}</a>
          </li>
        )}
        {org.email && (
          <li>
            <a className="gt-btn gt-btn-small" href={`mailto:${org.email}`}>{COPY.emailUs} {org.email}</a>
          </li>
        )}
        {org.socialLinks.map((s) => (
          <li key={s}>
            <a className="gt-btn gt-btn-small" href={s} target="_blank" rel="noopener noreferrer">{socialName(s)}</a>
          </li>
        ))}
      </ul>
      {org.address && (
        <p className="gt-small">
          <a className="underline" href={`https://maps.google.com/?q=${encodeURIComponent(org.address)}`} target="_blank" rel="noopener noreferrer">
            {org.address}
          </a>
        </p>
      )}
      {onWaysToGive && hasOpen && (
        <button type="button" className="gt-btn gt-btn-primary w-full" onClick={onWaysToGive}>
          {COPY.seeWaysToGive(org.name)}
        </button>
      )}
    </article>
  );
}

export default function Partners({
  orgs,
  focusId,
  openOrgIds,
  onBack,
  onWaysToGive,
}: {
  orgs: PublicOrg[];
  focusId: string | null;
  openOrgIds: Set<string>;
  onBack: () => void;
  onWaysToGive: (orgId: string) => void;
}) {
  const shown = orgs.filter((o) => o.showOnPartners);
  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-[var(--gt-sheet-max)] mx-auto px-3 py-3 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h1 className="gt-display text-[var(--gt-size-xl)]">{COPY.partnersTitle}</h1>
          <button type="button" className="gt-btn gt-btn-small" onClick={onBack}>
            {COPY.back}
          </button>
        </div>
        <p className="gt-muted">{COPY.partnersIntro}</p>
        {shown.length === 0 && <p>{COPY.partnersEmpty}</p>}
        {shown.map((o) => (
          <PartnerCard key={o.id} org={o} focused={o.id === focusId} hasOpen={openOrgIds.has(o.id)} onWaysToGive={() => onWaysToGive(o.id)} />
        ))}
      </div>
    </div>
  );
}
