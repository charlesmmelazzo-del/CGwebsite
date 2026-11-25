import { redirect } from "next/navigation";
import Unavailable from "@/components/passport/Unavailable";
import { NewInboxItem } from "@/components/passport/Inbox";
import { loadMe } from "@/lib/passport/page";
import { parseAbout } from "@/lib/passport/inbox";

export const dynamic = "force-dynamic";

/** File 08: Message the bar (optionally about a cocktail, bottle or house list), Make a request, Plan an event. */
export default async function NewInboxPage({ searchParams }: { searchParams: { kind?: string; about?: string; name?: string } }) {
  const kind = searchParams.kind === "request" || searchParams.kind === "event" ? searchParams.kind : "message";
  const s = await loadMe();
  if (s.unavailable) return <Unavailable />;
  if (!s.me) redirect("/passport");
  const about = kind === "message" ? parseAbout(searchParams.about) : null;
  const m = s.me.member;
  return <NewInboxItem kind={kind} about={about} aboutName={about ? String(searchParams.name || "").slice(0, 80) : ""} me={{ first_name: m.first_name, email: m.email, phone: m.phone }} />;
}
