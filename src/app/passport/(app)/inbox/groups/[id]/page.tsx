import { notFound } from "next/navigation";
import Unavailable from "@/components/passport/Unavailable";
import { GroupView } from "@/components/passport/Rooms";
import { passport } from "@/lib/passport/bible";
import { memberData } from "@/lib/passport/member";
import type { ChatRoom } from "@/lib/passport/chat";

export const dynamic = "force-dynamic";

/** File 16: a friend group the member is in (anyone else's, or one they left, is not found). */
export default async function Page({ params }: { params: { id: string } }) {
  const id = Number(params.id);
  if (!Number.isInteger(id) || id <= 0) notFound();
  const r = await memberData((auth) => passport<{ room: ChatRoom }>("GET", `/chat/group/${id}`, { auth }));
  if (r.notFound) notFound();
  if (!r.data) return <Unavailable />;
  return <GroupView key={r.data.room.id} initial={r.data.room} />;
}
