import { notFound } from "next/navigation";
import Unavailable from "@/components/passport/Unavailable";
import { ChannelView } from "@/components/passport/Rooms";
import { passport } from "@/lib/passport/bible";
import { memberData } from "@/lib/passport/member";
import type { ChatRoom } from "@/lib/passport/chat";

export const dynamic = "force-dynamic";

/** File 16: a channel the member has joined (one they may not see, or haven't joined, is not found: join from Browse). */
export default async function Page({ params }: { params: { id: string } }) {
  const id = Number(params.id);
  if (!Number.isInteger(id) || id <= 0) notFound();
  const r = await memberData((auth) => passport<{ room: ChatRoom }>("GET", `/chat/channel/${id}`, { auth }));
  if (r.notFound) notFound();
  if (!r.data) return <Unavailable />;
  return <ChannelView key={r.data.room.id} initial={r.data.room} />;
}
