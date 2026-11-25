import { notFound } from "next/navigation";
import Unavailable from "@/components/passport/Unavailable";
import { InquiryView } from "@/components/passport/Inbox";
import { getInquiry, getMe } from "@/lib/passport/bible";
import { memberData } from "@/lib/passport/member";

export const dynamic = "force-dynamic";

/** File 08: one of the member's own event inquiries (another member's number is simply not found). */
export default async function Page({ params }: { params: { id: string } }) {
  const id = Number(params.id);
  if (!Number.isInteger(id) || id <= 0) notFound();
  const r = await memberData(async (auth) => { const [q, me] = await Promise.all([getInquiry(auth, id), getMe(auth)]); return { q, me: me.member }; });
  if (r.notFound) notFound();
  if (!r.data) return <Unavailable />;
  return <InquiryView key={r.data.q.id} initial={r.data.q} me={{ email: r.data.me.email, phone: r.data.me.phone }} />;
}
