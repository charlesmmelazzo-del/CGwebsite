import { notFound, redirect } from "next/navigation";
import Shell, { ComingSoon, type Tab } from "@/components/passport/Shell";
import Unavailable from "@/components/passport/Unavailable";
import { loadMe } from "@/lib/passport/page";

export const dynamic = "force-dynamic";

/** The bottom bar's other tabs. Only Home works in file 01; these say what's coming. */
const SOON: Record<string, { title: string; line: string }> = {
  lists: { title: "Lists", line: "Your favorites, ratings, tasting notes and top tens, all in one place." },
  messages: { title: "Messages", line: "A direct line to the bar, and a way to tell friends you're on your way." },
};

export default async function TabPage({ params }: { params: { tab: string } }) {
  const soon = SOON[params.tab];
  if (!soon) notFound();
  const s = await loadMe();
  if (s.unavailable) return <Unavailable />;
  if (!s.me) redirect("/passport");
  return <Shell tab={params.tab as Tab}><ComingSoon {...soon} /></Shell>;
}
