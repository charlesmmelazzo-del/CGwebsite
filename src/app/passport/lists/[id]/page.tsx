import { notFound } from "next/navigation";
import Shell from "@/components/passport/Shell";
import Unavailable from "@/components/passport/Unavailable";
import { ListEditor } from "@/components/passport/Personal";
import { getList } from "@/lib/passport/bible";
import { memberData } from "@/lib/passport/member";

export const dynamic = "force-dynamic";

/** File 04: one of the member's own lists (another member's number is simply not found). */
export default async function ListPage({ params }: { params: { id: string } }) {
  const id = Number(params.id);
  if (!Number.isInteger(id) || id <= 0) notFound();
  const r = await memberData((auth) => getList(auth, id));
  if (r.notFound) notFound();
  if (!r.data) return <Unavailable />;
  return <Shell tab="lists"><ListEditor key={r.data.id} initial={r.data} /></Shell>;
}
