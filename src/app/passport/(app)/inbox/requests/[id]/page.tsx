import { notFound } from "next/navigation";
import Unavailable from "@/components/passport/Unavailable";
import { RequestView } from "@/components/passport/Inbox";
import { getMemberRequest } from "@/lib/passport/bible";
import { memberData } from "@/lib/passport/member";

export const dynamic = "force-dynamic";

/** File 08: one of the member's own requests (another member's number is simply not found). */
export default async function Page({ params }: { params: { id: string } }) {
  const id = Number(params.id);
  if (!Number.isInteger(id) || id <= 0) notFound();
  const r = await memberData((auth) => getMemberRequest(auth, id));
  if (r.notFound) notFound();
  if (!r.data) return <Unavailable />;
  return <RequestView key={r.data.id} initial={r.data} />;
}
