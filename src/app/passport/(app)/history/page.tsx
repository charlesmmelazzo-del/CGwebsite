import Link from "next/link";
import { BackLink } from "@/components/passport/bits";
import Unavailable from "@/components/passport/Unavailable";
import { PageTitle, Quiet, SectionTitle } from "@/components/passport/Library";
import { itemHref } from "@/components/passport/personalShared";
import { C } from "@/components/passport/theme";
import { getHistory, type HistoryItem } from "@/lib/passport/bible";
import { memberData } from "@/lib/passport/member";

export const dynamic = "force-dynamic";

const day = (d: string) => new Date(`${d.slice(0, 10)}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

function Row({ h, rank }: { h: HistoryItem; rank: number }) {
  const href = h.opens ? itemHref(h.kind, h.id) : null;
  const name = <span className={h.kind === "cocktail" ? "font-display text-[20px] leading-tight" : "font-body text-[15px]"} style={{ color: href ? C.text : C.muted }}>{h.name}</span>;
  return (
    <li className="flex items-baseline gap-3 py-3 border-b" style={{ borderColor: C.line }}>
      <span className="font-display text-lg w-6 text-right shrink-0" style={{ color: C.faint }}>{rank}</span>
      <div className="flex-1 min-w-0">
        {href ? <Link href={href}>{name}</Link> : name}
        {h.label && <span className="ml-2 font-body text-[10px] tracking-[0.15em] uppercase whitespace-nowrap" style={{ color: C.faint }}>{h.label}</span>}
        <span className="block font-body text-xs mt-0.5" style={{ color: C.faint }}>{h.last_ordered ? `Last had ${day(h.last_ordered)}` : "Ordered by your household"}</span>
      </div>
      <span className="font-body text-sm whitespace-nowrap" style={{ color: C.brass }}>{h.count}×</span>
    </li>
  );
}

/**
 * File 04: the member's top cocktails and spirits by count, with the date they last had each. Counts and dates only.
 * File 13: "Me and my household" (the default when they and someone in their household share order history) or "Just
 * me" (?view=me). A household member's checks add to the counts; only the member's own dates ever show.
 */
export default async function HistoryPage({ searchParams }: { searchParams?: { view?: string } }) {
  const asked = searchParams?.view === "me" ? "me" : null;
  const r = await memberData((auth) => getHistory(auth, asked));
  if (!r.data) return <Unavailable />;
  const h = r.data;
  return (
    <>
      <BackLink fallback="/passport/library" label="Index" />
      <div className="mt-3" />
      <PageTitle kicker="Yours" title="Your history" />
      {h.household && (
        <nav aria-label="Whose orders" className="flex gap-2 mt-4 mb-2">
          {([["household", "Me and my household", "/passport/history"], ["me", "Just me", "/passport/history?view=me"]] as const).map(([v, label, href]) => (
            <Link key={v} href={href} replace scroll={false} aria-current={h.view === v ? "page" : undefined}
              className="rounded-full px-4 min-h-[44px] inline-flex items-center font-body text-[12px] tracking-[0.12em] uppercase pp-focus border"
              style={h.view === v ? { background: C.brass, color: "#13170F", borderColor: C.brass } : { color: C.muted, borderColor: C.line }}>{label}</Link>
          ))}
        </nav>
      )}
      {h.household && h.view === "household" && <p className="font-body text-xs leading-relaxed mb-2" style={{ color: C.faint }}>Counts include checks paid by someone in your household. Change this in Account.</p>}
      {h.empty ? (
        <Quiet>Your order history will appear here after your visits.</Quiet>
      ) : (
        <>
          <SectionTitle>Top cocktails</SectionTitle>
          {h.cocktails.length ? <ol>{h.cocktails.map((x, i) => <Row key={`${x.kind}-${x.id ?? x.name}-${i}`} h={x} rank={i + 1} />)}</ol> : <Quiet>No cocktails yet.</Quiet>}
          <SectionTitle>Top spirits</SectionTitle>
          {h.spirits.length ? <ol>{h.spirits.map((x, i) => <Row key={`${x.kind}-${x.id ?? x.name}-${i}`} h={x} rank={i + 1} />)}</ol> : <Quiet>No spirits yet.</Quiet>}
        </>
      )}
    </>
  );
}
