import { notFound } from "next/navigation";
import Shell from "@/components/passport/Shell";
import Unavailable from "@/components/passport/Unavailable";
import { CocktailPage } from "@/components/passport/Library";
import { getCocktail } from "@/lib/passport/bible";
import { memberData } from "@/lib/passport/member";

export const dynamic = "force-dynamic";

export default async function CocktailRoute({ params }: { params: { id: string } }) {
  const id = Number(params.id);
  if (!Number.isInteger(id) || id <= 0) notFound();
  const r = await memberData((auth) => getCocktail(auth, id));
  if (r.notFound) notFound();
  if (!r.data) return <Unavailable />;
  return <Shell tab="library"><CocktailPage c={r.data} /></Shell>;
}
