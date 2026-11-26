import { notFound } from "next/navigation";
import Unavailable from "@/components/passport/Unavailable";
import { ProposeChannel } from "@/components/passport/Rooms";
import { passport } from "@/lib/passport/bible";
import { memberData } from "@/lib/passport/member";
import type { ChatOverview } from "@/lib/passport/chat";

export const dynamic = "force-dynamic";

/**
 * File 16: suggest (With approval) or start (On) a channel. With Passport settings at Off (the default) there is no
 * such page: members see no way to create or propose a channel.
 */
export default async function Page() {
  const r = await memberData((auth) => passport<ChatOverview>("GET", "/chat", { auth }));
  if (!r.data) return <Unavailable />;
  if (r.data.can_start === "off") notFound();
  return <ProposeChannel mode={r.data.can_start} />;
}
