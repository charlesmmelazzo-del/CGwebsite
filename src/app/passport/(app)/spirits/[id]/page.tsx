import { notFound } from "next/navigation";
import Unavailable from "@/components/passport/Unavailable";
import { BottlePage } from "@/components/passport/Library";
import { ItemControls } from "@/components/passport/Personal";
import { MyItemPhotos } from "@/components/passport/Photos";
import { RequestBottle } from "@/components/passport/Bottles";
import { AskAboutThis } from "@/components/passport/Inbox";
import { ShareButton } from "@/components/passport/Social";
import { getBottle, getMine } from "@/lib/passport/bible";
import { memberData } from "@/lib/passport/member";

export const dynamic = "force-dynamic";

/** File 03a: a bottle page (spirits list, archive; file 15 Part F: beer, wine and cider too, the same page and personal layer). */
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
      {/* File 11: the member's own photos (up to three here), private to them and the Common Good team. */}
      <MyItemPhotos key={`photos-bottle-${id}`} kind="bottle" id={id} name={r.data.b.name} />
      {/* File 05: every bottle page a member can open (the Bible refuses any other). File 15, Part F: not for a beer,
          wine or cider that isn't sold whole (by the glass, from a keg) or is no longer carried (can_request false). */}
      {(r.data.b as { can_request?: boolean }).can_request !== false && <RequestBottle key={`request-${id}`} bottleId={id} name={r.data.b.name} />}
      {/* File 08: a message to the bar with this bottle attached. */}
      <AskAboutThis kind="bottle" id={id} name={r.data.b.name} />
      {/* File 09: share it with friends. */}
      <div className="mt-3"><ShareButton kind="bottle" id={id} name={r.data.b.name} /></div>
    </>
  );
}
