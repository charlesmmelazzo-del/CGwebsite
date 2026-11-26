import { redirect } from "next/navigation";

/** File 06: the spirits list lives on the Menu tab; file 14: its own Spirits tab, by category. */
export default function SpiritsRoute() {
  redirect("/passport/menu?tab=spirits");
}
