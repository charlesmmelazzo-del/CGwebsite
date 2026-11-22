import Shell from "@/components/passport/Shell";
import Unavailable from "@/components/passport/Unavailable";
import { BottleRow, CocktailRow, PageTitle, Quiet, SectionTitle } from "@/components/passport/Library";
import { getArchive, getBaseSpirits, getLibrary } from "@/lib/passport/bible";
import { memberData } from "@/lib/passport/member";

export const dynamic = "force-dynamic";

/** The Library tab: every cocktail we've poured since Spring 2026 (as admins allow), searchable, and the spirits archive. */
export default async function LibraryPage({ searchParams }: { searchParams: { q?: string; spirit?: string } }) {
  const q = typeof searchParams.q === "string" ? searchParams.q.trim().slice(0, 100) : "";
  const spirit = typeof searchParams.spirit === "string" ? searchParams.spirit.trim().slice(0, 40) : "";
  const r = await memberData(async (auth) => {
    const [cocktails, archive, spirits] = await Promise.all([getLibrary(auth, q, spirit), q || spirit ? Promise.resolve([]) : getArchive(auth), getBaseSpirits(auth)]);
    return { cocktails, archive, spirits };
  });
  if (!r.data) return <Unavailable />;
  const { cocktails, archive, spirits } = r.data;
  const chosen = spirits.find((s) => s.key === spirit);
  const href = (key: string) => { const p = new URLSearchParams(); if (q) p.set("q", q); if (key) p.set("spirit", key); const s = p.toString(); return `/passport/library${s ? `?${s}` : ""}`; };
  return (
    <Shell tab="library">
      <PageTitle kicker="Every cocktail we've poured" title="Library" />
      <form action="/passport/library" method="get" role="search">
        <input name="q" defaultValue={q} type="search" placeholder="Search by name or ingredient" aria-label="Search the library"
          className="w-full rounded-lg px-4 py-3 font-body text-[16px] bg-[#0E120B] border border-[#323B29] text-[#EDE6D3] placeholder:text-[#5d6a52] focus:outline-none focus:border-[#C9A96E]" />
        {spirit && <input type="hidden" name="spirit" value={spirit} />}
      </form>
      {spirits.length > 0 && (
        <nav aria-label="Filter by base spirit" className="mt-3 -mx-1 flex gap-2 overflow-x-auto pb-1 px-1">
          {[{ key: "", label: "All", count: 0 }, ...spirits].map((s) => {
            const on = s.key === (chosen ? chosen.key : "");
            return (
              <a key={s.key || "all"} href={href(s.key)} aria-current={on ? "true" : undefined}
                className="shrink-0 rounded-full border px-3 py-1 font-body text-xs whitespace-nowrap"
                style={on ? { borderColor: "#C9A96E", color: "#C9A96E", background: "#1a1f14" } : { borderColor: "#323B29", color: "#97A586" }}>
                {s.label}{s.key ? <span style={{ opacity: 0.6 }}> {s.count}</span> : null}
              </a>
            );
          })}
        </nav>
      )}
      <SectionTitle aside={q || spirit ? <a href="/passport/library" className="font-body text-xs underline" style={{ color: "#97A586" }}>Clear</a> : undefined}>
        {q ? `Cocktails matching “${q}”${chosen ? ` · ${chosen.label}` : ""}` : chosen ? `${chosen.label} cocktails` : "Cocktails"}
      </SectionTitle>
      {cocktails.length
        ? <ul>{cocktails.map((c) => <CocktailRow key={c.id} c={c} />)}</ul>
        : <Quiet>{q ? "Nothing matches that. Try one ingredient, like “mezcal”." : spirit ? "No cocktails under that spirit yet." : "The library is being filled in."}</Quiet>}
      {!q && !spirit && (
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
