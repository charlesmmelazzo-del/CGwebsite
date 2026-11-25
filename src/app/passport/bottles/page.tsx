import Link from "next/link";
import Shell from "@/components/passport/Shell";
import Unavailable from "@/components/passport/Unavailable";
import { PageTitle } from "@/components/passport/Library";
import { MyBottles } from "@/components/passport/Bottles";
import { C } from "@/components/passport/theme";
import { getBottleRequests } from "@/lib/passport/bible";
import { memberData } from "@/lib/passport/member";
import { sortRequests } from "@/lib/passport/bottles";

export const dynamic = "force-dynamic";

/** File 05: My bottles. The member's own bottle requests: status, the confirmed price, the arrival date and the bar's message. */
export default async function BottlesPage() {
  const r = await memberData((auth) => getBottleRequests(auth));
  if (!r.data) return <Unavailable />;
  return (
    <Shell tab="lists">
      <Link href="/passport/lists" className="font-body text-xs tracking-[0.2em] uppercase" style={{ color: C.muted }}>← Your Passport</Link>
      <div className="mt-5" />
      <PageTitle kicker="For home" title="My bottles" />
      <MyBottles initial={{ ...r.data, requests: sortRequests(r.data.requests) }} />
    </Shell>
  );
}
