import { notFound } from "next/navigation";
import Unavailable from "@/components/passport/Unavailable";
import { SharedView } from "@/components/passport/Social";
import { getShare } from "@/lib/passport/bible";
import { memberData } from "@/lib/passport/member";

export const dynamic = "force-dynamic";

/** File 09: a copy of a friend's list or recipe shared with the member (names and order only; never their stars or notes). */
export default async function Page({ params }: { params: { id: string } }) {
  const id = Number(params.id);
  if (!Number.isInteger(id) || id <= 0) notFound();
  const r = await memberData((auth) => getShare(auth, id));
  if (r.notFound) notFound();
  if (!r.data) return <Unavailable />;
  return <SharedView key={r.data.id} initial={r.data} />;
}
