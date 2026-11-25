import { notFound } from "next/navigation";
import Unavailable from "@/components/passport/Unavailable";
import { HouseListPage } from "@/components/passport/HouseList";
import { getChart } from "@/lib/passport/bible";
import { memberData } from "@/lib/passport/member";

export const dynamic = "force-dynamic";

/** File 07: Top of the Charts or Critics' Choice, while it is showing. The order only. */
export default async function ChartRoute({ params }: { params: { key: string } }) {
  if (params.key !== "top" && params.key !== "critics") notFound();
  const r = await memberData((auth) => getChart(auth, params.key));
  if (r.notFound) notFound();
  if (!r.data) return <Unavailable />;
  return <HouseListPage key={r.data.key} chart={r.data} />;
}
