import Unavailable from "@/components/passport/Unavailable";
import { PastLists } from "@/components/passport/HouseList";
import { getPastLists } from "@/lib/passport/bible";
import { memberData } from "@/lib/passport/member";

export const dynamic = "force-dynamic";

/** File 07: "Past lists from Common Good", from the Index. */
export default async function PastListsRoute() {
  const r = await memberData((auth) => getPastLists(auth));
  if (!r.data) return <Unavailable />;
  return <PastLists lists={r.data} />;
}
