import { redirect } from "next/navigation";

/** File 06: the member's lists now live at the top of the Index tab (with Favorites, Notes, Recipes and History). */
export default function ListsRoute() {
  redirect("/passport/library#lists");
}
