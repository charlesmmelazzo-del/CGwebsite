import { notFound } from "next/navigation";
import Unavailable from "@/components/passport/Unavailable";
import { ThreadView } from "@/components/passport/Rooms";
import { passport } from "@/lib/passport/bible";
import { memberData } from "@/lib/passport/member";
import type { ChatRoom } from "@/lib/passport/chat";

export const dynamic = "force-dynamic";

/** File 16: a thread in a channel the member is in: the message and its replies. */
export default async function Page({ params }: { params: { id: string; key: string } }) {
  const id = Number(params.id);
  const post = Number(params.key);
  if (!Number.isInteger(id) || id <= 0 || !Number.isInteger(post) || post <= 0) notFound();
  const r = await memberData((auth) => passport<{ room: ChatRoom }>("GET", `/chat/channel/${id}/threads/${post}`, { auth }));
  if (r.notFound) notFound();
  if (!r.data) return <Unavailable />;
  return <ThreadView key={r.data.room.id} initial={r.data.room} />;
}
