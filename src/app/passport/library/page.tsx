import Shell from "@/components/passport/Shell";
import Unavailable from "@/components/passport/Unavailable";
import { BottleRow, CocktailRow, PageTitle, Quiet, SectionTitle } from "@/components/passport/Library";
import { getArchive, getLibrary } from "@/lib/passport/bible";
import { memberData } from "@/lib/passport/member";

export const dynamic = "force-dynamic";

/** The Library tab: every cocktail we've poured since Spring 2026 (as admins allow), searchable, and the spirits archive. */
export default async function LibraryPage({ searchParams }: { searchParams: { q?: string } }) {
  const q = typeof searchParams.q === "string" ? searchParams.q.trim().slice(0, 100) : "";
  const r = await memberData(async (auth) => {
    const [cocktails, archive] = await Promise.all([getLibrary(auth, q), q ? Promise.resolve([]) : getArchive(auth)]);
    return { cocktails, archive };
  });
  if (!r.data) return <Unavailable />;
  const { cocktails, archive } = r.data;
  return (
    <Shell tab="library">
      <PageTitle kicker="Every cocktail we've poured" title="Library" />
      <form action="/passport/library" method="get" role="search">
        <input name="q" defaultValue={q} type="search" placeholder="Search by name or ingredient" aria-label="Search the library"
          className="w-full rounded-lg px-4 py-3 font-body text-[16px] bg-[#0E120B] border border-[#323B29] text-[#EDE6D3] placeholder:text-[#5d6a52] focus:outline-none focus:border-[#C9A96E]" />
      </form>
      <SectionTitle aside={q ? <a href="/passport/library" className="font-body text-xs underline" style={{ color: "#97A586" }}>Clear</a> : undefined}>
        {q ? `Cocktails matching “${q}”` : "Cocktails"}
      </SectionTitle>
      {cocktails.length
        ? <ul>{cocktails.map((c) => <CocktailRow key={c.id} c={c} />)}</ul>
        : <Quiet>{q ? "Nothing matches that. Try one ingredient, like “mezcal”." : "The library is being filled in."}</Quiet>}
      {!q && (
        <>
          <SectionTitle>Spirits</SectionTitle>
          <a href="/passport/spirits" className="block rounded-xl border px-5 py-4 font-body text-[15px]" style={{ borderColor: "#323B29", color: "#EDE6D3" }}>
            The spirits list, by category, with pour prices →
          </a>
          <span id="archive" />
          <SectionTitle>Spirits archive</SectionTitle>
          <Quiet>Bottles we no longer carry. Your history with them stays here.</Quiet>
          {archive.length ? <ul className="mt-2">{archive.map((b) => <BottleRow key={b.id} b={b} />)}</ul> : null}
        </>
      )}
    </Shell>
  );
}
