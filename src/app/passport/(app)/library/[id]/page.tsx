import { notFound } from "next/navigation";
import Unavailable from "@/components/passport/Unavailable";
import { CocktailPage } from "@/components/passport/Library";
import { ItemControls } from "@/components/passport/Personal";
import { getCocktail, getMine } from "@/lib/passport/bible";
import { memberData } from "@/lib/passport/member";

export const dynamic = "force-dynamic";

export default async function CocktailRoute({ params }: { params: { id: string } }) {
  const id = Number(params.id);
  if (!Number.isInteger(id) || id <= 0) notFound();
  const r = await memberData(async (auth) => {
    const [c, mine] = await Promise.all([getCocktail(auth, id), getMine(auth, "cocktail", id)]);
    return { c, mine };
  });
  if (r.notFound) notFound();
  if (!r.data) return <Unavailable />;
  return (
    <>
      <CocktailPage c={r.data.c} />
      <ItemControls key={`cocktail-${id}`} kind="cocktail" id={id} name={r.data.c.name} initial={r.data.mine} />
    </>
  );
}
