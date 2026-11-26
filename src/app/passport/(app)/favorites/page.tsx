import { BackLink } from "@/components/passport/bits";
import Unavailable from "@/components/passport/Unavailable";
import { PageTitle, Quiet, SectionTitle } from "@/components/passport/Library";
import { ItemLine, RemoveRecord } from "@/components/passport/Personal";
import { C } from "@/components/passport/theme";
import { getFavorites } from "@/lib/passport/bible";
import { memberData } from "@/lib/passport/member";

export const dynamic = "force-dynamic";

/** File 04: the member's favorite cocktails and bottles, and their own ratings (highest first). */
export default async function FavoritesPage() {
  const r = await memberData((auth) => getFavorites(auth));
  if (!r.data) return <Unavailable />;
  const { favorites, ratings } = r.data;
  const cocktails = favorites.filter((f) => f.kind === "cocktail");
  const bottles = favorites.filter((f) => f.kind === "bottle");
  return (
    <>
      <BackLink fallback="/passport/library?at=journal" label="Journal" />
      <div className="mt-3" />
      <PageTitle kicker="Journal" title="Favorites" />
      {!favorites.length && !ratings.length && <Quiet>Tap the heart on any cocktail or bottle to keep it here.</Quiet>}
      {cocktails.length > 0 && (
        <>
          <SectionTitle>Cocktails</SectionTitle>
          <ul>{cocktails.map((f) => <ItemLine key={f.ref} kind={f.kind} id={f.id} name={f.name} label={f.label} opens={f.opens} aside={<RemoveRecord what="favorite" refId={f.ref} />} />)}</ul>
        </>
      )}
      {bottles.length > 0 && (
        <>
          <SectionTitle>Bottles</SectionTitle>
          <ul>{bottles.map((f) => <ItemLine key={f.ref} kind={f.kind} id={f.id} name={f.name} label={f.label} opens={f.opens} aside={<RemoveRecord what="favorite" refId={f.ref} />} />)}</ul>
        </>
      )}
      {ratings.length > 0 && (
        <>
          <SectionTitle>Your ratings</SectionTitle>
          <ul>
            {ratings.map((x) => (
              <ItemLine key={x.ref} kind={x.kind} id={x.id} name={x.name} label={x.label} opens={x.opens} aside={<RemoveRecord what="rating" refId={x.ref} label="Clear" />}>
                <span className="block font-body text-[1rem] mt-0.5" style={{ color: C.brass }} aria-label={`${x.stars} of 5 stars`}>
                  {"★".repeat(x.stars)}<span style={{ color: C.line }}>{"★".repeat(5 - x.stars)}</span>
                </span>
              </ItemLine>
            ))}
          </ul>
        </>
      )}
    </>
  );
}
