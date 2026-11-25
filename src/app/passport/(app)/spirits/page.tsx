import { redirect } from "next/navigation";

/** File 06: the spirits list now lives on the Menu tab, by category. */
export default function SpiritsRoute() {
  redirect("/passport/menu#spirits");
}
