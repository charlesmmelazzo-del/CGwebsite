import { BackLink } from "@/components/passport/bits";
import Unavailable from "@/components/passport/Unavailable";
import { PageTitle, Quiet } from "@/components/passport/Library";
import { ItemLine, RemoveRecord } from "@/components/passport/Personal";
import { PRIVATE_LINE } from "@/components/passport/personalShared";
import { C } from "@/components/passport/theme";
import { getNotes } from "@/lib/passport/bible";
import { memberData } from "@/lib/passport/member";

export const dynamic = "force-dynamic";

/** File 04: every tasting note the member has kept. Edit a note on the cocktail or bottle page itself. */
export default async function NotesPage() {
  const r = await memberData((auth) => getNotes(auth));
  if (!r.data) return <Unavailable />;
  return (
    <>
      <BackLink fallback="/passport/library" label="Index" />
      <div className="mt-3" />
      <PageTitle kicker="Yours" title="My notes">
        <p className="font-body text-xs mt-2" style={{ color: C.faint }}>{PRIVATE_LINE}</p>
      </PageTitle>
      {r.data.length ? (
        <ul>
          {r.data.map((n) => (
            <ItemLine key={n.ref} kind={n.kind} id={n.id} name={n.name} label={n.label} opens={n.opens} aside={<RemoveRecord what="note" refId={n.ref} label="Delete" />}>
              <p className="font-body text-[15px] mt-1 leading-relaxed whitespace-pre-line" style={{ color: C.text }}>{n.body}</p>
            </ItemLine>
          ))}
        </ul>
      ) : (
        <Quiet>Keep a note on any cocktail or bottle from its page, and they all gather here.</Quiet>
      )}
    </>
  );
}
