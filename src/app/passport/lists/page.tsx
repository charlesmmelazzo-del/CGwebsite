import Link from "next/link";
import Shell from "@/components/passport/Shell";
import Unavailable from "@/components/passport/Unavailable";
import { PageTitle, SectionTitle } from "@/components/passport/Library";
import { ListsManager } from "@/components/passport/Personal";
import { C } from "@/components/passport/theme";
import { getLists } from "@/lib/passport/bible";
import { memberData } from "@/lib/passport/member";

export const dynamic = "force-dynamic";

const PLACES = [
  { href: "/passport/favorites", title: "Favorites", line: "Cocktails and bottles you love, and your ratings" },
  { href: "/passport/notes", title: "My notes", line: "Your tasting notes" },
  { href: "/passport/bespoke", title: "Bespoke recipes", line: "Drinks made for you, and your own" },
  { href: "/passport/history", title: "Your history", line: "What you've ordered, and how often" },
];

/** File 04: the Lists tab. The member's own corner: favorites, notes, recipes, history, and their lists and top 10s. */
export default async function ListsPage() {
  const r = await memberData((auth) => getLists(auth));
  if (!r.data) return <Unavailable />;
  return (
    <Shell tab="lists">
      <PageTitle kicker="Yours" title="Your Passport" />
      <ul className="grid grid-cols-2 gap-3">
        {PLACES.map((p) => (
          <li key={p.href}>
            <Link href={p.href} className="block h-full rounded-xl border p-4" style={{ borderColor: C.line, background: C.card }}>
              <span className="font-display text-[21px] leading-tight block" style={{ color: C.text }}>{p.title}</span>
              <span className="font-body text-xs mt-1 block leading-snug" style={{ color: C.muted }}>{p.line}</span>
            </Link>
          </li>
        ))}
      </ul>
      <SectionTitle>Lists and top 10s</SectionTitle>
      <ListsManager initial={r.data} />
    </Shell>
  );
}
