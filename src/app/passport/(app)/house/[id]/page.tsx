import { notFound } from "next/navigation";
import Unavailable from "@/components/passport/Unavailable";
import { HouseListPage } from "@/components/passport/HouseList";
import { AskAboutThis } from "@/components/passport/Inbox";
import { ShareButton } from "@/components/passport/Social";
import { getHouseList } from "@/lib/passport/bible";
import { memberData } from "@/lib/passport/member";

export const dynamic = "force-dynamic";

/** File 07: one house list, live or in the archive. Anything this member may not see is simply not found. */
export default async function HouseListRoute({ params }: { params: { id: string } }) {
  const id = Number(params.id);
  if (!Number.isInteger(id) || id <= 0) notFound();
  const r = await memberData((auth) => getHouseList(auth, id));
  if (r.notFound) notFound();
  if (!r.data) return <Unavailable />;
  return (
    <>
      <HouseListPage key={r.data.id} list={r.data} />
      {/* File 08: a message to the bar with this list attached. */}
      <AskAboutThis kind="list" id={r.data.id} name={r.data.title} />
      {/* File 09: share the bar's list with friends. */}
      <div className="mt-3"><ShareButton kind="house_list" id={r.data.id} name={r.data.title} /></div>
    </>
  );
}
