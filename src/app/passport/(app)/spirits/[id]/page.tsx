import { notFound } from "next/navigation";
import Unavailable from "@/components/passport/Unavailable";
import { BottlePage } from "@/components/passport/Library";
import { ItemControls } from "@/components/passport/Personal";
import { RequestBottle } from "@/components/passport/Bottles";
import { AskAboutThis } from "@/components/passport/Inbox";
import { ShareButton } from "@/components/passport/Social";
import { getBottle, getMine } from "@/lib/passport/bible";
import { memberData } from "@/lib/passport/member";

export const dynamic = "force-dynamic";

/** File 03a: a simple bottle page, for the spirits list and the archive. The rich bottle and producer pages come in 03b. */
export default async function BottleRoute({ params }: { params: { id: string } }) {
  const id = Number(params.id);
  if (!Number.isInteger(id) || id <= 0) notFound();
  const r = await memberData(async (auth) => {
    const [b, mine] = await Promise.all([getBottle(auth, id), getMine(auth, "bottle", id)]);
    return { b, mine };
  });
  if (r.notFound) notFound();
  if (!r.data) return <Unavailable />;
  return (
    <>
      <BottlePage b={r.data.b} />
      <ItemControls key={`bottle-${id}`} kind="bottle" id={id} name={r.data.b.name} initial={r.data.mine} />
      {/* File 05: every bottle page a member can open (the Bible refuses any other). */}
      <RequestBottle key={`request-${id}`} bottleId={id} name={r.data.b.name} />
      {/* File 08: a message to the bar with this bottle attached. */}
      <AskAboutThis kind="bottle" id={id} name={r.data.b.name} />
      {/* File 09: share it with friends. */}
      <div className="mt-3"><ShareButton kind="bottle" id={id} name={r.data.b.name} /></div>
    </>
  );
}
