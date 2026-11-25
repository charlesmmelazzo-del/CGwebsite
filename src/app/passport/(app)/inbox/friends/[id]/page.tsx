import { notFound } from "next/navigation";
import Unavailable from "@/components/passport/Unavailable";
import { ConversationView } from "@/components/passport/Social";
import { getConversation, getFriends } from "@/lib/passport/bible";
import { memberData } from "@/lib/passport/member";

export const dynamic = "force-dynamic";

/**
 * File 09: a conversation with a friend (one the member is in; anyone else's is not found). "new?friend=…" starts one
 * with a friend (the friendship number), and only with someone who is still a friend.
 */
export default async function Page({ params, searchParams }: { params: { id: string }; searchParams: { friend?: string } }) {
  if (params.id === "new") {
    const friend = Number(searchParams.friend);
    if (!Number.isInteger(friend) || friend <= 0) notFound();
    const r = await memberData((auth) => getFriends(auth));
    if (!r.data) return <Unavailable />;
    const f = r.data.friends.find((x) => x.id === friend);
    if (!f) notFound();
    if (f.conversation_id) {
      const c = await memberData((auth) => getConversation(auth, f.conversation_id!));
      if (!c.data) return <Unavailable />;
      return <ConversationView key={c.data.id} initial={c.data} />;
    }
    return <ConversationView initial={null} friendId={f.id} friendName={f.name} />;
  }
  const id = Number(params.id);
  if (!Number.isInteger(id) || id <= 0) notFound();
  const r = await memberData((auth) => getConversation(auth, id));
  if (r.notFound) notFound();
  if (!r.data) return <Unavailable />;
  return <ConversationView key={r.data.id} initial={r.data} />;
}
