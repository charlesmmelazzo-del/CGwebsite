import { notFound } from "next/navigation";
import Unavailable from "@/components/passport/Unavailable";
import Comments from "@/components/passport/Comments";
import { BracketPage } from "@/components/passport/Votes";
import { getBracket } from "@/lib/passport/bible";
import { memberData } from "@/lib/passport/member";

export const dynamic = "force-dynamic";

/** File 10: one bracket, the whole tree. A draft, one not yet started or a test-only one (for a real member) is not found. */
export default async function Page({ params }: { params: { id: string } }) {
  const id = Number(params.id);
  if (!Number.isInteger(id) || id <= 0) notFound();
  const r = await memberData((auth) => getBracket(auth, id));
  if (r.notFound) notFound();
  if (!r.data) return <Unavailable />;
  return (
    <>
      <BracketPage key={r.data.id} initial={r.data} />
      <Comments type="bracket" id={r.data.id} />
    </>
  );
}
