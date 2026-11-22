import { notFound } from "next/navigation";
import Shell from "@/components/passport/Shell";
import Unavailable from "@/components/passport/Unavailable";
import { BottlePage } from "@/components/passport/Library";
import { getBottle } from "@/lib/passport/bible";
import { memberData } from "@/lib/passport/member";

export const dynamic = "force-dynamic";

/** File 03a: a simple bottle page, for the spirits list and the archive. The rich bottle and producer pages come in 03b. */
export default async function BottleRoute({ params }: { params: { id: string } }) {
  const id = Number(params.id);
  if (!Number.isInteger(id) || id <= 0) notFound();
  const r = await memberData((auth) => getBottle(auth, id));
  if (r.notFound) notFound();
  if (!r.data) return <Unavailable />;
  return <Shell tab="library"><BottlePage b={r.data} /></Shell>;
}
