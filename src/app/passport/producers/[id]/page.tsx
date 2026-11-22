import { notFound } from "next/navigation";
import Shell from "@/components/passport/Shell";
import Unavailable from "@/components/passport/Unavailable";
import { ProducerPage } from "@/components/passport/Library";
import { getProducer } from "@/lib/passport/bible";
import { memberData } from "@/lib/passport/member";

export const dynamic = "force-dynamic";

/** File 03b: a producer page. Only producers with a bottle a member may open have one. */
export default async function ProducerRoute({ params }: { params: { id: string } }) {
  const id = Number(params.id);
  if (!Number.isInteger(id) || id <= 0) notFound();
  const r = await memberData((auth) => getProducer(auth, id));
  if (r.notFound) notFound();
  if (!r.data) return <Unavailable />;
  return <Shell tab="library"><ProducerPage p={r.data} /></Shell>;
}
